import React, { useState, useEffect, useRef } from "react";

const Logo = ({ size = "medium" }) => {
  const sizes = {
    small: "h-10 w-10",
    medium: "h-14 w-14",
    large: "h-24 w-24",
  };
  
  const [isClicked, setIsClicked] = useState(false);
  const [pulseAngle, setPulseAngle] = useState(0);
  const [heartbeat, setHeartbeat] = useState(false);
  const diagonalRef = useRef(null);
  
  // Always animate pulse effect
  useEffect(() => {
    const interval = setInterval(() => {
      setPulseAngle(prev => (prev + 10) % 360);
    }, 100);
    return () => clearInterval(interval);
  }, []);
  
  // Heartbeat animation
  useEffect(() => {
    const interval = setInterval(() => {
      setHeartbeat(prev => !prev);
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  
  // Continuous color animation for diagonal line
  useEffect(() => {
    if (!diagonalRef.current) return;
    
    const colors = ["#1E3A8A", "#1E40AF", "#1D4ED8", "#2563EB"];
    let colorIndex = 0;
    
    const interval = setInterval(() => {
      if (diagonalRef.current) {
        // Subtly change color even when not clicked
        const currentColor = isClicked ? colors[colorIndex] : colors[0];
        diagonalRef.current.setAttribute('stroke', currentColor);
        colorIndex = (colorIndex + 1) % colors.length;
      }
    }, isClicked ? 200 : 1000);
    
    if (isClicked) {
      const timeout = setTimeout(() => {
        setIsClicked(false);
      }, 2000);
      
      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    }
    
    return () => clearInterval(interval);
  }, [isClicked]);

  const handleClick = () => {
    setIsClicked(true);
  };

  return (
    <div 
      className={`${sizes[size]} relative cursor-pointer`}
      onClick={handleClick}
    >
      <svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="darkBlueGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1E3A8A" />
            <stop offset="100%" stopColor="#1E40AF" />
          </linearGradient>
          
          <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="5" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
          
          <filter id="brightGlow" x="-20%" y="-20%" width="140%" height="140%">
            <feFlood result="flood" floodColor="#3B82F6" floodOpacity="1" />
            <feComposite in="flood" in2="SourceGraphic" operator="in" result="mask" />
            <feGaussianBlur in="mask" stdDeviation="2" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>
        
        {/* Circle background for contrast */}
        <circle 
          cx="100" 
          cy="100" 
          r="100" 
          fill="none" 
        />
        
        {/* Background with always visible animation */}
        <g>
          {[...Array(8)].map((_, i) => {
            const angle = (pulseAngle + (i * 45)) % 360;
            const radians = angle * Math.PI / 180;
            return (
              <circle 
                key={i}
                cx={100 + Math.cos(radians) * 80}
                cy={100 + Math.sin(radians) * 80}
                r="3"
                fill="#3B82F6"
                opacity="0.9"
                className="animate-pulse"
              />
            );
          })}
        </g>
        
        <g>
          {/* Horizontal line of plus */}
          <rect 
            x="30" 
            y="90" 
            width="140" 
            height="20" 
            fill={isClicked ? "url(#darkBlueGradient)" : "#1D4ED8"} 
            rx="5"
            style={{ transition: 'fill 0.3s ease' }}
          />
          
          {/* Vertical line of plus */}
          <rect 
            x="90" 
            y="30" 
            width="20" 
            height="140" 
            fill={isClicked ? "url(#darkBlueGradient)" : "#1D4ED8"} 
            rx="5"
            style={{ transition: 'fill 0.3s ease' }}
          />
          
          {/* Diagonal line from 2nd quadrant (top-left) to 4th quadrant (bottom-right) */}
          <path 
            ref={diagonalRef}
            d="M 50,50 L 150,150" 
            stroke="#1D4ED8" 
            strokeWidth="20" 
            strokeLinecap="round"
          />
          
          {/* Diagonal line only in 3rd quadrant (bottom-left) */}
          <path 
            d="M 50,150 L 90,110" 
            stroke="#1D4ED8" 
            strokeWidth="20" 
            strokeLinecap="round"
          />
        </g>
        
        {/* Blue circle in first quadrant with always visible animations */}
        <g filter="url(#brightGlow)">
          <circle 
            cx="145" 
            cy="55" 
            r="22" 
            fill={isClicked ? "#1D4ED8" : "#1E40AF"}
            style={{ transition: 'fill 0.3s ease' }}
          />
          <circle 
            cx="145" 
            cy="55" 
            r="16" 
            stroke="white" 
            strokeWidth="3" 
            fill="none"
          />
          
          {/* Always visible medical heartbeat line inside the circle */}
          <path
            d="M 132,55 L 137,55 L 140,48 L 143,62 L 146,55 L 158,55"
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
            opacity={heartbeat ? "1" : "0.9"}
            style={{ transition: 'opacity 0.5s ease' }}
          />
        </g>
        
        {/* Always visible dots (not animated) */}
        {[...Array(12)].map((_, i) => {
          const angle = i * 30;
          return (
            <circle
              key={i}
              cx={100 + Math.cos(angle * Math.PI / 180) * 70}
              cy={100 + Math.sin(angle * Math.PI / 180) * 70}
              r="2"
              fill={isClicked ? "#3B82F6" : "#2563EB"}
              opacity="0.9"
            />
          );
        })}
        
        {/* Extra effect when clicked */}
        {isClicked && (
          <circle
            cx="100"
            cy="100"
            r="60"
            fill="none"
            stroke="#3B82F6"
            strokeWidth="3"
            opacity="0.9"
            className="animate-ping"
          />
        )}
      </svg>
    </div>
  );
};

export default Logo;