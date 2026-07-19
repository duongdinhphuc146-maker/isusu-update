async function testReplay() {
  console.log('[TEST] Sending test replay request to Bridge on port 5001...');
  
  const testPayload = {
    provider: 'aistudio',
    prompt: '{"translations": [{"id": 1, "text": "Hello, how are you today?"}]}'
  };

  try {
    const response = await fetch('http://127.0.0.1:5001/replay', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testPayload)
    });

    console.log(`[TEST] Status: ${response.status}`);
    const result = await response.json();
    console.log('[TEST] Response Result:', JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('[TEST] Replay call failed:', err);
  }
}

testReplay();
