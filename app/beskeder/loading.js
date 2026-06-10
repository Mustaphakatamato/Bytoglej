export default function Loading() {
  return (
    <div style={{ minHeight: '100vh', background: '#F6F2EA', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #CFE3D8', borderTopColor: '#2A7D4F', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
