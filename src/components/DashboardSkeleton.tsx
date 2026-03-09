import React from 'react';
import Skeleton from './Skeleton';
import './Skeleton.css';
import '../pages/Dashboard.css';

const DashboardSkeleton: React.FC = () => {
    return (
        <div className="page-container">
            <div className="page-header">
                <Skeleton width={250} height={32} />
            </div>

            {/* KPI Cards Skeleton */}
            <div className="kpi-grid">
                {[1, 2].map(i => (
                    <div className="kpi-card" key={i}>
                        <Skeleton circle width={40} height={40} />
                        <div className="kpi-content" style={{ marginLeft: '12px', flex: 1 }}>
                            <Skeleton width="60%" height={14} className="skeleton-text" />
                            <Skeleton width="80%" height={32} />
                        </div>
                    </div>
                ))}
            </div>

            {/* Chart Skeleton */}
            <div className="card">
                <div className="card-header-flex">
                    <Skeleton width={200} height={24} />
                </div>
                <div className="bar-chart" style={{ gap: '24px', padding: '40px 16px' }}>
                    {Array.from({ length: 12 }).map((_, i) => (
                        <div className="bar-col" key={i} style={{ height: '240px' }}>
                            <div className="bar-group" style={{ height: '100%' }}>
                                <Skeleton width={36} height={`${(i * 17) % 60 + 20}%`} />
                            </div>
                            <Skeleton width={24} height={12} style={{ marginTop: '12px' }} />
                        </div>
                    ))}
                </div>
            </div>

            <div className="two-col">
                <div className="card">
                    <Skeleton width={150} height={24} style={{ marginBottom: '20px' }} />
                    {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                            <Skeleton circle width={24} height={24} />
                            <Skeleton width="70%" height={20} />
                            <Skeleton width="20%" height={20} style={{ marginLeft: 'auto' }} />
                        </div>
                    ))}
                </div>
                <div className="card">
                    <Skeleton width={150} height={24} style={{ marginBottom: '20px' }} />
                    {Array.from({ length: 3 }).map((_, i) => (
                        <div key={i} style={{ marginBottom: '20px' }}>
                            <Skeleton width="40%" height={14} style={{ marginBottom: '8px' }} />
                            <Skeleton width="100%" height={8} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default DashboardSkeleton;
