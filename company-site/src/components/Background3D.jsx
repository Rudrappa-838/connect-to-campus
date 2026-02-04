export default function Background3D() {
    return (
        <div
            className="fixed inset-0 z-0"
            style={{
                background: 'linear-gradient(to bottom, #000000 0%, #0a0a0a 50%, #000000 100%)',
                overflow: 'hidden'
            }}
        >
            {/* Subtle dark purple glow */}
            <div
                style={{
                    position: 'absolute',
                    width: '600px',
                    height: '600px',
                    background: 'radial-gradient(circle, rgba(75, 0, 130, 0.03) 0%, transparent 70%)',
                    top: '10%',
                    left: '10%',
                    filter: 'blur(100px)',
                    opacity: 0.3
                }}
            />
            <div
                style={{
                    position: 'absolute',
                    width: '500px',
                    height: '500px',
                    background: 'radial-gradient(circle, rgba(25, 25, 112, 0.04) 0%, transparent 70%)',
                    bottom: '10%',
                    right: '15%',
                    filter: 'blur(100px)',
                    opacity: 0.3
                }}
            />
        </div>
    )
}
