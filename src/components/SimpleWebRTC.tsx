import { useEffect, useRef, useState } from "react";

export default function SimpleWebRTC() {
  const log = (...args: unknown[]) => console.log("[SimpleWebRTC]", ...args);

  // References to the <video> elements so we can plug streams into them.
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // References that persist the peer connection and WebSocket across renders.
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const [started, setStarted] = useState(false);

  useEffect(() => {
      log("useEffect invoked for websocket initialization");
      if (wsRef.current) {
        log("WebSocket already exists, skipping re-initialization");
        return; // prevent duplicate connections
      }

      log("Creating new WebSocket connection");
      const ws = new WebSocket("ws://localhost:8080");
      wsRef.current = ws;

      ws.onopen = () => {
        log("WebSocket open, sending join payload", ws.readyState);

        ws.send(
          JSON.stringify({
            type: "join",
            roomId: "room1",
          })
        );
      };

      ws.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        log("Incoming signaling message", data.type);

        if (!pcRef.current) {
          log("Peer connection not ready yet, ignoring message");
          return;
        }

        if (data.type === "offer") {
          log("Processing remote offer");
          await pcRef.current.setRemoteDescription(data);
          const answer = await pcRef.current.createAnswer();
          await pcRef.current.setLocalDescription(answer);
          ws.send(JSON.stringify(answer));
          log("Sent answer back to caller");
        }

        if (data.type === "answer") {
          log("Applying remote answer");
          await pcRef.current.setRemoteDescription(data);
        }

        if (data.type === "ice") {
          log("Applying remote ICE candidate");
          try {
            await pcRef.current.addIceCandidate(data.candidate);
            log("Remote ICE candidate added");
          } catch (err) {
            console.error("[SimpleWebRTC] ICE Error:", err);
          }
        }
      };

      ws.onclose = () => log("WebSocket closed by server");
      ws.onerror = (e) => log("WebSocket error", e);

      return () => {
        log("Cleanup: closing WebSocket");
        ws.close();
        wsRef.current = null;
      };
    }, []);


  const startCall = async () => {
    log("startCall invoked");
    setStarted(true);

    // Create a peer connection with a public STUN server for NAT traversal.
    pcRef.current = new RTCPeerConnection({
      iceServers: [
        { urls: ["stun:stun.l.google.com:19302"] }
      ],
    });
    log("PeerConnection created");

    // Whenever we discover a local ICE candidate, push it through signaling.
    pcRef.current.onicecandidate = (event) => {
      if (event.candidate) {
        log("Discovered local ICE candidate, sending through signaling");
        wsRef.current?.send(
          JSON.stringify({ type: "ice", candidate: event.candidate })
        );
      } else {
        log("Finished gathering ICE candidates");
      }
    };

    // When the remote peer sends us media, display the first stream.
    pcRef.current.ontrack = (event) => {
      log("Received remote track, attaching to video element");
      remoteVideoRef.current!.srcObject = event.streams[0];
    };

    try {
      // Ask the user for camera + mic permission and add tracks to the connection.
      log("Requesting local media (camera + mic)");
      const localStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      log("Local media stream acquired");

      localStream.getTracks().forEach((track) => {
        log(`Adding local ${track.kind} track to PeerConnection`);
        pcRef.current!.addTrack(track, localStream);
      });

      // Show the local preview.
      localVideoRef.current!.srcObject = localStream;
      log("Local preview stream attached");
    } catch (err) {
      console.error("[SimpleWebRTC] Failed to acquire media", err);
      return;
    }

    // Create and send our SDP offer to kick off negotiation.
    log("Creating SDP offer");
    const offer = await pcRef.current.createOffer();
    await pcRef.current.setLocalDescription(offer);
    log("Local description set, sending offer through signaling");

    wsRef.current?.send(JSON.stringify(offer));
  };

  return (
    <div>

      <button disabled={started} onClick={startCall}>
        Start Call
      </button>

      <div style={{ marginTop: "20px", display: "flex", gap: "20px" }}>
        <div>
          <h3>Local Video</h3>
          <video ref={localVideoRef} autoPlay playsInline style={{ width: 250 }} />
        </div>

        <div>
          <h3>Remote Video</h3>
          <video ref={remoteVideoRef} autoPlay playsInline style={{ width: 250 }} />
        </div>
      </div>
    </div>
  );
}
