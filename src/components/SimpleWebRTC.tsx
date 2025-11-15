import { useEffect, useRef, useState } from "react";

export default function SimpleWebRTC() {
  // References to the <video> elements so we can plug streams into them.
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);

  // References that persist the peer connection and WebSocket across renders.
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  const [started, setStarted] = useState(false);

  useEffect(() => {
    // Establish a signaling channel to exchange SDP/ICE messages.
    wsRef.current = new WebSocket("ws://localhost:8080");

    wsRef.current.onmessage = async (event) => {
      const data = JSON.parse(event.data);

      if (!pcRef.current) return;

      // Remote peer sent an offer: respond with an answer.
      if (data.type === "offer") {
        await pcRef.current.setRemoteDescription(data);
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);
        wsRef.current?.send(JSON.stringify(answer));
      }

      // Remote peer accepted our offer, so finalize the remote description.
      if (data.type === "answer") {
        await pcRef.current.setRemoteDescription(data);
      }

      // Remote ICE candidates help establish the peer-to-peer path.
      if (data.type === "ice") {
        try {
          await pcRef.current.addIceCandidate(data.candidate);
        } catch (err) {
          console.error("ICE Error:", err);
        }
      }
    };
  }, []);

  const startCall = async () => {
    setStarted(true);

    // Create a peer connection with a public STUN server for NAT traversal.
    pcRef.current = new RTCPeerConnection({
      iceServers: [
        { urls: ["stun:stun.l.google.com:19302"] }
      ],
    });

    // Whenever we discover a local ICE candidate, push it through signaling.
    pcRef.current.onicecandidate = (event) => {
      if (event.candidate) {
        wsRef.current?.send(
          JSON.stringify({ type: "ice", candidate: event.candidate })
        );
      }
    };

    // When the remote peer sends us media, display the first stream.
    pcRef.current.ontrack = (event) => {
      remoteVideoRef.current!.srcObject = event.streams[0];
    };

    // Ask the user for camera + mic permission and add tracks to the connection.
    const localStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    localStream.getTracks().forEach((track) => {
      pcRef.current!.addTrack(track, localStream);
    });

    // Show the local preview.
    localVideoRef.current!.srcObject = localStream;

    // Create and send our SDP offer to kick off negotiation.
    const offer = await pcRef.current.createOffer();
    await pcRef.current.setLocalDescription(offer);

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
