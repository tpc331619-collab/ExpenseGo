import React, { useState } from 'react';
import PurchaseModal from './PurchaseModal';
import { useAuth } from '../contexts/AuthContext';
import './QuickAddFAB.css';

const QuickAddFAB: React.FC = () => {
    const { appUser } = useAuth();
    const [isOpen, setIsOpen] = useState(false);

    if (appUser?.role === 'guest') return null;

    return (
        <>
            <button
                className="quick-add-fab"
                onClick={() => setIsOpen(true)}
                title="快速新增採購紀錄"
            >
                <span className="fab-icon">＋</span>
            </button>

            {isOpen && (
                <PurchaseModal onClose={() => setIsOpen(false)} />
            )}
        </>
    );
};

export default QuickAddFAB;
