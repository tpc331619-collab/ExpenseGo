import React from 'react';
import './Skeleton.css';

interface SkeletonProps {
    width?: string | number;
    height?: string | number;
    circle?: boolean;
    className?: string;
    style?: React.CSSProperties;
}

const Skeleton: React.FC<SkeletonProps> = ({ width, height, circle, className = '', style }) => {
    const combinedStyle: React.CSSProperties = {
        width,
        height,
        borderRadius: circle ? '50%' : '8px',
        ...style
    };

    return <div className={`skeleton-base ${className}`} style={combinedStyle} />;
};

export default Skeleton;
