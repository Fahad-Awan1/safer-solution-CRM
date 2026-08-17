async function main() {
  console.log('Sending login request...');
  const res = await fetch('https://safer-solution-crm-nine.vercel.app/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'fahadriazcs@gmail.com', password: 'Fahad@6599' }),
  });
  console.log('Status:', res.status);
  const data = await res.json();
  console.log('Response:', data);
}

main().catch(console.error);
