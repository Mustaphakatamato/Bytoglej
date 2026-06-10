export default function Loading() {
  return (
    <div style={{ minHeight: '100vh', background: '#F6F2EA', padding: '24px 16px' }}>
      <div style={{ maxWidth: 1140, margin: '0 auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(240px,1fr))', gap: 18 }}>
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} style={{ borderRadius: 20, overflow: 'hidden', background: '#ECE6DA', height: 320, animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
    </div>
  );
}
