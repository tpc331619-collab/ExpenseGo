import React from 'react';

interface LogoProps {
    className?: string;
    width?: number;
    height?: number;
}

const Logo: React.FC<LogoProps> = ({ className = '', width = 32, height = 32 }) => {
    return (
        <svg
            width={width}
            height={height}
            viewBox="0 0 48 48"
            fill="none"
            className={className}
            xmlns="http://www.w3.org/2000/svg"
        >
            <rect width="48" height="48" rx="14" fill="url(#logo-grad)" />

            {/* 'P' Outline */}
            <path
                d="M16 36V14H25A8 8 0 0 1 25 30H16"
                stroke="white"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />
            {/* 'Go' Arrow breaking out of the P */}
            <path
                d="M21 25L34 12M34 12H27M34 12V19"
                stroke="#FFD700"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            <defs>
                <linearGradient id="logo-grad" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
                    <stop stopColor="#6366f1" />
                    <stop offset="1" stopColor="#8b5cf6" />
                </linearGradient>
            </defs>
        </svg>
    );
};

export default Logo;
