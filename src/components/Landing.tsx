import { useEffect, useRef, useState } from "react";
import { Room } from "./Room";
import "..//components/Landing.css";
import { FaVideo, FaVideoSlash, FaMicrophone, FaMicrophoneSlash } from "react-icons/fa";

export const Landing = () => {
  const [name, setName] = useState("");
  const [localAudioTrack, setLocalAudioTrack] = useState<MediaStreamTrack | null>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<MediaStreamTrack | null>(null);
  const [isAudioEnabled, setIsAudioEnabled] = useState(true);
  const [isVideoEnabled, setIsVideoEnabled] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getCam = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      const audioTrack = stream.getAudioTracks()[0];
      const videoTrack = stream.getVideoTracks()[0];
      setLocalAudioTrack(audioTrack);
      setLocalVideoTrack(videoTrack);
      if (videoRef.current) {
        videoRef.current.srcObject = new MediaStream([videoTrack]);
        videoRef.current.play();
      }
    } catch (error) {
      console.error("Error accessing camera/microphone", error);
      setError("Could not access camera or microphone. Please check your device permissions.");
    }
  };

  useEffect(() => {
    if (videoRef.current) {
      getCam();
    }
  }, []);

  const toggleAudio = () => {
    if (localAudioTrack) {
      localAudioTrack.enabled = !localAudioTrack.enabled;
      setIsAudioEnabled(localAudioTrack.enabled);
    }
  };

  const toggleVideo = () => {
    if (localVideoTrack) {
      localVideoTrack.enabled = !localVideoTrack.enabled;
      setIsVideoEnabled(localVideoTrack.enabled);
    }
  };

  const handleJoin = () => {
    if (!name.trim()) {
      setError("Please enter your name to join");
      return;
    }
    setJoined(true);
  };

  if (!joined) {
    return (
      <div className="landing-container">
        <div className="landing-card">
          <h1 className="landing-title">LASD</h1>
          <div className="video-preview-container">
            {error && <div className="error-message">{error}</div>}
            <video autoPlay ref={videoRef} className="video-preview"></video>
            <div className="video-controls">
              <button
                className={`control-button ${isAudioEnabled ? "active" : "inactive"}`}
                onClick={toggleAudio}
                title={isAudioEnabled ? "Mute Audio" : "Unmute Audio"}
              >
                {isAudioEnabled ? <FaMicrophone /> : <FaMicrophoneSlash />}
              </button>
              <button
                className={`control-button ${isVideoEnabled ? "active" : "inactive"}`}
                onClick={toggleVideo}
                title={isVideoEnabled ? "Turn Off Camera" : "Turn On Camera"}
              >
                {isVideoEnabled ? <FaVideo /> : <FaVideoSlash />}
              </button>
            </div>
          </div>
          <div className="input-group">
            <input
              type="text"
              placeholder="Enter your name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="name-input"
            />
          </div>
          <button onClick={handleJoin} className="join-button">
            Join Now
          </button>
        </div>
      </div>
    );
  }

  return (
    <Room 
      name={name} 
      localAudioTrack={localAudioTrack} 
      localVideoTrack={localVideoTrack} 
      initialAudioEnabled={isAudioEnabled}
      initialVideoEnabled={isVideoEnabled}
    />
  );
};