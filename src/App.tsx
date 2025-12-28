import React from 'react';

const App = () => {
  return (
    <div style={{ height: '100vh', backgroundColor: '#000', color: '#fff', display: 'flex', flexDirection: 'column' }}>
      <div style={{ backgroundColor: '#facc15', color: '#000', padding: '20px', textAlign: 'center', fontWeight: 'bold', fontSize: '1.5rem' }}>
        ⚠️ V15 - PATH FIXED (YELLOW BAR) ⚠️
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <h1 style={{ fontSize: '2rem' }}>מחובר ומוכן!</h1>
      </div>
    </div>
  );
};

export default App;
