import React, { useState, useEffect } from 'react';
import { getVendors } from '../lib/firestore';
import type { Vendor } from '../types';
import { Building2, User, Phone, X } from 'lucide-react';
import './VendorDetailCard.css';

interface Props {
    vendorName: string;
    onClose: () => void;
}

const VendorDetailCard: React.FC<Props> = ({ vendorName, onClose }) => {
    const [vendor, setVendor] = useState<Vendor | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchVendor = async () => {
            setLoading(true);
            try {
                const allVendors = await getVendors();
                const v = allVendors.find(vend => vend.name === vendorName);
                if (v) setVendor(v);
            } catch (err) {
                console.error('Failed to fetch vendor:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchVendor();
    }, [vendorName]);

    return (
        <div className="v-card-overlay" onClick={onClose}>
            <div className="v-card-modal" onClick={e => e.stopPropagation()}>
                <button className="v-card-close" onClick={onClose}><X size={20} /></button>

                {loading ? (
                    <div className="v-card-loading">
                        <div className="spinner" />
                        <p>載入廠商資料...</p>
                    </div>
                ) : vendor ? (
                    <>
                        <div className="v-card-header">
                            <div className="v-icon-box">
                                <Building2 size={24} />
                            </div>
                            <div className="v-title-area">
                                <h2>{vendor.name}</h2>
                                {vendor.taxId && <span className="v-tax-tag">統編：{vendor.taxId}</span>}
                            </div>
                        </div>

                        <div className="v-card-body">
                            <div className="v-info-group">
                                <div className="v-info-item">
                                    <User className="v-item-icon" size={16} />
                                    <div className="v-item-content">
                                        <label>聯絡人</label>
                                        <span>{vendor.contact || '(未填寫)'}</span>
                                    </div>
                                </div>
                                <div className="v-info-item">
                                    <Phone className="v-item-icon" size={16} />
                                    <div className="v-item-content">
                                        <label>聯絡電話</label>
                                        <span>{vendor.phone || '(未填寫)'}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="v-divider" />
                        </div>
                    </>
                ) : (
                    <div className="v-card-empty">
                        <Building2 size={48} className="empty-icon" />
                        <h3>找不到「{vendorName}」的核心檔案</h3>
                        <p>請至「管理」建立該廠商的正式資料卡。</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VendorDetailCard;
