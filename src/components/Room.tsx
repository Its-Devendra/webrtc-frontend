import { useEffect, useRef, useState } from "react";
import { Socket, io } from "socket.io-client";
import { FaMicrophone, FaMicrophoneSlash, FaVideo, FaVideoSlash, FaPhoneSlash, FaPaperPlane, FaRandom } from "react-icons/fa";
import "../components/Room.css";

const URL = import.meta.env.MODE === "development"
  ? import.meta.env.VITE_BACKEND_DEV_URL
  : import.meta.env.VITE_BACKEND_PROD_URL;


// ICE servers configuration: STUN server for public IP discovery and TURN server for relay.
const iceServers = [
  { urls: 'stun:stun.relay.metered.ca:80' },
  { 
    urls: "turn:global.relay.metered.ca:80",
        username: "95c9ed4f36d6ac36a891830d",
        credential: "mTH2Tkob+VS2LMLQ",

  },
  {
    urls: "turn:global.relay.metered.ca:80?transport=tcp",
    username: "95c9ed4f36d6ac36a891830d",
    credential: "mTH2Tkob+VS2LMLQ",
  },
  {
    urls: "turn:global.relay.metered.ca:443",
    username: "95c9ed4f36d6ac36a891830d",
    credential: "mTH2Tkob+VS2LMLQ",
  },
  {
    urls: "turns:global.relay.metered.ca:443?transport=tcp",
    username: "95c9ed4f36d6ac36a891830d",
    credential: "mTH2Tkob+VS2LMLQ",
  },
];

export const Room = ({
    name,
    localAudioTrack,
    localVideoTrack,
    initialAudioEnabled = true,
    initialVideoEnabled = true
}: {
    name: string,
    localAudioTrack: MediaStreamTrack | null,
    localVideoTrack: MediaStreamTrack | null,
    initialAudioEnabled?: boolean,
    initialVideoEnabled?: boolean
}) => {
    const [lobby, setLobby] = useState(true);
    const [socket, setSocket] = useState<null | Socket>(null);
    const [sendingPc, setSendingPc] = useState<null | RTCPeerConnection>(null);
    const [receivingPc, setReceivingPc] = useState<null | RTCPeerConnection>(null);
    // const [remoteVideoTrack, setRemoteVideoTrack] = useState<MediaStreamTrack | null>(null);
    // const [remoteAudioTrack, setRemoteAudioTrack] = useState<MediaStreamTrack | null>(null);
    // const [remoteMediaStream, setRemoteMediaStream] = useState<MediaStream | null>(null);
    const [isAudioEnabled, setIsAudioEnabled] = useState(initialAudioEnabled);
    const [isVideoEnabled, setIsVideoEnabled] = useState(initialVideoEnabled);
    const [roomId, setRoomId] = useState<string | null>(null);
    const [chatMessages, setChatMessages] = useState<{sender: string, message: string}[]>([]);
    const [newMessage, setNewMessage] = useState("");
    const [isChatOpen, setIsChatOpen] = useState(false);
    const [isSkipping, setIsSkipping] = useState(false);

    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);
    const videoContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (localAudioTrack) {
            localAudioTrack.enabled = initialAudioEnabled;
        }
        if (localVideoTrack) {
            localVideoTrack.enabled = initialVideoEnabled;
        }
    }, [localAudioTrack, localVideoTrack, initialAudioEnabled, initialVideoEnabled]);

    useEffect(() => {
        const socket = io(URL, { transports: ["websocket"] });
        socket.on('send-offer', async ({ roomId }) => {
            console.log("send-offer received with roomId:", roomId);
            setRoomId(roomId);
            setLobby(false);
            setIsSkipping(false);
            setChatMessages([]);
            
            // Create RTCPeerConnection with ICE servers configuration.
            const pc = new RTCPeerConnection({ iceServers });
            setSendingPc(pc);
            
            if (localVideoTrack) {
                console.log("adding local video track", localVideoTrack);
                pc.addTrack(localVideoTrack);
            }
            if (localAudioTrack) {
                console.log("adding local audio track", localAudioTrack);
                pc.addTrack(localAudioTrack);
            }

            pc.onicecandidate = async (e) => {
                console.log("local ICE candidate");
                if (e.candidate) {
                   socket.emit("add-ice-candidate", {
                    candidate: e.candidate,
                    type: "sender",
                    roomId
                   });
                }
            };

            pc.onnegotiationneeded = async () => {
                console.log("negotiation needed, sending offer");
                const sdp = await pc.createOffer();
                pc.setLocalDescription(sdp);
                socket.emit("offer", { sdp, roomId });
            };
        });

        socket.on("offer", async ({ roomId, sdp: remoteSdp }) => {
            console.log("offer received with roomId:", roomId);
            setRoomId(roomId);
            setLobby(false);
            setIsSkipping(false);
            setChatMessages([]);
            
            // Create RTCPeerConnection with ICE servers configuration.
            const pc = new RTCPeerConnection({ iceServers });
            pc.setRemoteDescription(remoteSdp);
            const sdp = await pc.createAnswer();
            pc.setLocalDescription(sdp);
            const stream = new MediaStream();
            if (remoteVideoRef.current) {
                remoteVideoRef.current.srcObject = stream;
            }

            // setRemoteMediaStream(stream);
            setReceivingPc(pc);

            pc.ontrack = (e) => {
                const track = e.track;
                if (remoteVideoRef.current?.srcObject instanceof MediaStream) {
                    remoteVideoRef.current.srcObject.addTrack(track);
                }
            };

            pc.onicecandidate = async (e) => {
                if (!e.candidate) return;
                console.log("receiver ICE candidate");
                socket.emit("add-ice-candidate", {
                    candidate: e.candidate,
                    type: "receiver",
                    roomId
                });
            };

            socket.emit("answer", { roomId, sdp });
            setTimeout(() => {
                const transceivers = pc.getTransceivers();
                if (transceivers.length >= 2) {
                    const track1 = transceivers[0].receiver.track;
                    const track2 = transceivers[1].receiver.track;
                    if (track1.kind === "video") {
                        // setRemoteVideoTrack(track1);
                        // setRemoteAudioTrack(track2);
                    } else {
                        // setRemoteVideoTrack(track2);
                        // setRemoteAudioTrack(track1);
                    }
                    if (remoteVideoRef.current?.srcObject instanceof MediaStream) {
                        remoteVideoRef.current.srcObject.addTrack(track1);
                        remoteVideoRef.current.srcObject.addTrack(track2);
                    }
                    remoteVideoRef.current?.play();
                }
            }, 5000);
        });

        socket.on("answer", ({ sdp: remoteSdp }) => {
            setLobby(false);
            setSendingPc(pc => {
                pc?.setRemoteDescription(remoteSdp);
                return pc;
            });
            console.log("connection established");
        });

        socket.on("lobby", () => {
            setLobby(true);
            setIsSkipping(false);
            setChatMessages([]);
        });

        socket.on("add-ice-candidate", ({ candidate, type }) => {
            console.log("received ICE candidate from remote", { candidate, type });
            if (type === "sender") {
                setReceivingPc(pc => {
                    if (!pc) {
                        console.error("receiving pc not found");
                    } else {
                        pc.addIceCandidate(candidate);
                    }
                    return pc;
                });
            } else {
                setSendingPc(pc => {
                    if (!pc) {
                        console.error("sending pc not found");
                    } else {
                        pc.addIceCandidate(candidate);
                    }
                    return pc;
                });
            }
        });

        socket.on("chat-message", ({ message, sender }) => {
            if (sender !== socket.id) {
                console.log("Received chat message:", message, "from", sender);
                setChatMessages(prev => [...prev, { sender: "Stranger", message }]);
            }
        });

        socket.on("user-skipped", () => {
            console.log("Remote user skipped the chat");
            cleanupCurrentSession();
            setIsSkipping(false);
            setLobby(true);
        });

        socket.on("skip-error", ({ message }) => {
            console.error("Skip error:", message);
            setIsSkipping(false);
        });

        setSocket(socket);

        return () => {
            socket.disconnect();
        };
    }, [name, localAudioTrack, localVideoTrack]);

    useEffect(() => {
        if (localVideoRef.current && localVideoTrack) {
            const stream = new MediaStream();
            stream.addTrack(localVideoTrack);
            localVideoRef.current.srcObject = stream;
            localVideoRef.current.play().catch(error => {
                console.error("Error playing local video:", error);
            });
        }
    }, [localVideoRef, localVideoTrack]);

    useEffect(() => {
        if (chatContainerRef.current) {
            chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
    }, [chatMessages]);

    useEffect(() => {
        if (videoContainerRef.current) {
            if (window.innerWidth <= 768) return;
            videoContainerRef.current.style.width = isChatOpen ? `calc(100% - 350px)` : '100%';
        }
    }, [isChatOpen]);

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

    const cleanupCurrentSession = () => {
        if (sendingPc) {
            sendingPc.close();
            setSendingPc(null);
        }
        if (receivingPc) {
            receivingPc.close();
            setReceivingPc(null);
        }
        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = null;
        }
        // setRemoteVideoTrack(null);
        // setRemoteAudioTrack(null);
        // setRemoteMediaStream(null);
        setRoomId(null);
        setChatMessages([]);
    };

    const leaveCall = () => {
        cleanupCurrentSession();
        localAudioTrack?.stop();
        localVideoTrack?.stop();
        socket?.disconnect();
        window.location.href = '/';
    };

    const skipUser = () => {
        if (!socket || !roomId || isSkipping || lobby) return;
        setIsSkipping(true);
        socket.emit("skip-user", { roomId });
      // UI will wait for the "user-skipped" event from the server.
    };

    const sendChatMessage = () => {
        if (socket && roomId && newMessage.trim() !== "") {
            console.log("Sending chat message:", newMessage, "in room", roomId);
            socket.emit("chat-message", { roomId, message: newMessage });
            setChatMessages(prev => [...prev, { sender: "Me", message: newMessage }]);
            setNewMessage("");
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') sendChatMessage();
    };

    return (
        <div className="room-container">
            <div className="video-container" ref={videoContainerRef}>
                <div className="video-grid">
                    <div className="video-wrapper local-video-wrapper">
                        <video autoPlay muted ref={localVideoRef} className="video-element local-video" />
                        {!isVideoEnabled && (
                            <div className="video-off-indicator">
                                <FaVideoSlash />
                            </div>
                        )}
                        <div className="video-label">You ({name})</div>
                    </div>
                    <div className="video-wrapper remote-video-wrapper">
                        {lobby ? (
                            <div className="loading-container">
                                <div className="loading-spinner"></div>
                                <p>{isSkipping ? "Finding a new person to chat with..." : "Finding someone to chat with..."}</p>
                            </div>
                        ) : (
                            <>
                                <video autoPlay ref={remoteVideoRef} className="video-element remote-video" />
                                <div className="video-label">Stranger</div>
                            </>
                        )}
                    </div>
                </div>
                
                <div className="controls-container">
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
                    <button 
                        className="control-button skip-button" 
                        onClick={skipUser}
                        disabled={lobby || isSkipping}
                        title="Skip to Next Person"
                    >
                        <FaRandom />
                    </button>
                    <button 
                        className="control-button leave-button" 
                        onClick={leaveCall}
                        title="Leave Call"
                    >
                        <FaPhoneSlash />
                    </button>
                </div>
            </div>
            
            <div className={`chat-panel ${isChatOpen ? 'open' : ''}`}>
                <div className="chat-header">
                    <h3>Chat</h3>
                    <button 
                        className="toggle-chat-button"
                        onClick={() => setIsChatOpen(!isChatOpen)}
                    >
                        {isChatOpen ? '×' : 'Chat'}
                    </button>
                </div>
                <div className="chat-messages" ref={chatContainerRef}>
                    {chatMessages.length === 0 ? (
                        <div className="no-messages">No messages yet. Say hello!</div>
                    ) : (
                        chatMessages.map((msg, idx) => (
                            <div 
                                key={idx} 
                                className={`message ${msg.sender === "Me" ? "sent" : "received"}`}
                            >
                                <div className="message-content">{msg.message}</div>
                                <div className="message-sender">{msg.sender}</div>
                            </div>
                        ))
                    )}
                </div>
                <div className="chat-input-container">
                    <input 
                        type="text" 
                        value={newMessage} 
                        onChange={(e) => setNewMessage(e.target.value)} 
                        onKeyPress={handleKeyPress}
                        placeholder="Type your message..."
                        className="chat-input"
                    />
                    <button 
                        onClick={sendChatMessage} 
                        className="send-button"
                        disabled={!newMessage.trim()}
                    >
                        <FaPaperPlane />
                    </button>
                </div>
            </div>
        </div>
    );
};
