import { useEffect, useRef, useState } from "react";

export default function CameraSelector() {
  const videoRef = useRef<HTMLVideoElement>(null);

  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [stream, setStream] = useState<MediaStream | null>(null);

  const firstLoadRef = useRef(true);

  const startCamera = async (deviceId: string) => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { deviceId: { exact: deviceId } },
      audio: false,
    });
    setStream(stream);
    if (videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  };

  useEffect(() => {
    const loadDevices = async () => {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter((d) => d.kind === "videoinput");
      setCameras(videoDevices);

      // Only run default camera once
      if (firstLoadRef.current && videoDevices.length > 0) {
        firstLoadRef.current = false;
        const firstCam = videoDevices[0].deviceId;

        setSelectedCameraId(firstCam);
        // startCamera(firstCam); // now safe
      }
    };

    loadDevices();
  }, []);

  const handleCameraChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCam = e.target.value;
    setSelectedCameraId(newCam);
    startCamera(newCam);
  };


  const stopCamera = () => {
    stream?.getTracks().forEach((t) => t.stop());
    setStream(null);
  };


  return (
    <div style={{ padding: "20px" }}>
      <h2>Select Camera</h2>

      <select
        value={selectedCameraId}
        onChange={handleCameraChange}
        style={{ padding: "10px", width: "250px" }}
      >
        {cameras.map((cam, index) => (
          <option key={cam.deviceId} value={cam.deviceId}>
            {cam.label || `Camera ${index + 1}`}
          </option>
        ))}
      </select>

      <div style={{ marginTop: "20px" }}>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          style={{ width: "300px", borderRadius: "12px" }}
        />
      </div>

      {!stream ? (
        <button onClick={()=>startCamera(selectedCameraId)}>Start Camera</button>
      ) : (
        <button onClick={stopCamera}>Stop Camera</button>
      )}

    </div>
  );
}
