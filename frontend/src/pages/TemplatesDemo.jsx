import React, { useState } from 'react';
import SoftnetPamphletFront from '../components/templates/SoftnetPamphletFront';
import SoftnetPamphletBack from '../components/templates/SoftnetPamphletBack';
import './TemplatesDemo.css';

const TemplatesDemo = () => {
    const [activeTemplate, setActiveTemplate] = useState('pamphlet-front');

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="templates-demo-container">
            {/* Control Panel */}
            <div className="control-panel no-print">
                <div className="control-header">
                    <h1 className="demo-title">📄 CONNECT TO CAMPUS</h1>
                    <p className="demo-subtitle">By SoftForge Technologies | Advertisement Pamphlet</p>
                </div>

                <div className="template-selector">
                    <button
                        className={`select-btn ${activeTemplate === 'pamphlet-front' ? 'active' : ''}`}
                        onClick={() => setActiveTemplate('pamphlet-front')}
                    >
                        📑 FRONT Side (Features)
                    </button>
                    <button
                        className={`select-btn ${activeTemplate === 'pamphlet-back' ? 'active' : ''}`}
                        onClick={() => setActiveTemplate('pamphlet-back')}
                    >
                        📑 BACK Side (Pricing & Contact)
                    </button>
                </div>

                <button className="print-btn" onClick={handlePrint}>
                    🖨️ Print Current Side
                </button>

                <div className="info-box">
                    <p><strong>💡 Double-Sided Printing Instructions:</strong></p>
                    <p><strong>Step 1:</strong> Click "FRONT Side" button → Click Print → Print/Save as PDF</p>
                    <p><strong>Step 2:</strong> Flip the paper over</p>
                    <p><strong>Step 3:</strong> Click "BACK Side" button → Click Print → Print on reverse</p>
                    <p><strong>📐 Size:</strong> A4 (210mm × 297mm)</p>
                </div>
            </div>

            {/* Template Display */}
            <div className="template-display">
                {activeTemplate === 'pamphlet-front' && <SoftnetPamphletFront />}
                {activeTemplate === 'pamphlet-back' && <SoftnetPamphletBack />}
            </div>
        </div>
    );
};

export default TemplatesDemo;
