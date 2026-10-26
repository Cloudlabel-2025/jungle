export const initialFiles = {
  "src/App.jsx": `const { useState } = React;

// All balances are integer paise. This prevents float rounding errors.
export function parseAmount(value) {
  if (typeof value !== 'string' || !/^[0-9]+([.][0-9]{1,2})?$/.test(value))
    throw new Error('Use a positive INR amount with at most two decimals.');
  const [whole, fraction = ''] = value.split('.');
  const paise = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!Number.isSafeInteger(paise) || paise <= 0)
    throw new Error('Amount is outside the supported range.');
  return paise;
}

export function transfer(accounts, from, to, amount) {
  if (!Number.isSafeInteger(amount) || amount <= 0)
    throw new Error('Enter a positive amount in paise.');
  if (from === to) throw new Error('Choose different accounts.');
  if (!(from in accounts) || !(to in accounts))
    throw new Error('Account not found.');
  if (![accounts[from], accounts[to]].every(balance => Number.isSafeInteger(balance) && balance >= 0))
    throw new Error('Invalid account balance.');
  if (accounts[from] < amount) throw new Error('Insufficient funds.');
  if (!Number.isSafeInteger(accounts[to] + amount))
    throw new Error('Balance limit exceeded.');
  return { ...accounts, [from]: accounts[from] - amount,
    [to]: accounts[to] + amount };
}

export default function App() {
  const [accounts, setAccounts] = useState({ primary: 1245000, savings: 850000 });
  const [amount, setAmount] = useState('250');
  const [error, setError] = useState('');
  const [transactions, setTransactions] = useState([]);
  const money = (paise) => new Intl.NumberFormat('en-IN', {
    style: 'currency', currency: 'INR'
  }).format(paise / 100);
  function send(event) {
    event.preventDefault();
    try {
      const value = parseAmount(amount);
      const next = transfer(accounts, 'primary', 'savings', value);
      setAccounts(next);
      setTransactions([{ id: transactions.length + 1, amount: value }, ...transactions]);
      setError('');
    } catch (e) { setError(e.message); }
  }
  return <main className="bank">
    <header><b className="bank-logo">A<span>PEX</span></b><span>PERSONAL BANKING <i /></span></header>
    <section className="welcome"><small>YOUR MONEY. IN MOTION.</small>
      <h1>Good things ahead.</h1><p>Your financial overview, all in one place.</p></section>
    <div className="accounts">{Object.entries(accounts).map(([key, balance]) =>
      <article className="account" key={key}><span>{key.toUpperCase()} ACCOUNT</span>
        <h2>{money(balance)}</h2><small>AVAILABLE BALANCE</small></article>)}</div>
    <section className="transfer"><h3>Move money, effortlessly.</h3>
      <p>Primary to Savings · Instant internal transfer</p>
      <label>Amount in INR<input type="number" min="0.01" step="0.01" value={amount}
        onChange={event => setAmount(event.target.value)} required /></label>
      <button type="button" onClick={send}>Transfer funds</button>{error && <p role="alert" className="error">{error}</p>}</section>
    <section className="transactions"><h3>Recent activity</h3>
      {transactions.length ? transactions.map(t => <div key={t.id}>
        <span>Internal transfer · Savings</span><b>{money(t.amount)}</b></div>) :
        <p>No transfers yet. Your next move starts above.</p>}</section>
    <footer>APEX FINANCIAL · CODEWILD SANDBOX · NO REAL MONEY</footer>
  </main>;
}
`,
  "src/styles.css": `* { box-sizing: border-box; }
body { margin: 0; background: #f1f3ef; color: #19382f; font: 14px Arial, sans-serif; }
.bank { max-width: 850px; margin: auto; padding: 28px; }
header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 22px; border-bottom: 1px solid #d5ddd5; }
.bank-logo { font-size: 30px; letter-spacing: -2px; } .bank-logo span { font-weight: 400; }
header > span { font-size: 9px; letter-spacing: 1px; } header i { display: inline-block; width: 6px; height: 6px; border-radius: 50%; background: #5e9b68; margin-left: 8px; }
.welcome { margin: 30px 0 24px; } .welcome small { letter-spacing: 2px; font-size: 9px; }
h1 { font-size: 34px; letter-spacing: -1.5px; margin: 10px 0; } p { color: #67796f; line-height: 1.6; }
.accounts { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
.account { padding: 24px; background: #183e31; color: #e4efce; border-radius: 10px; }
.account:nth-child(2) { background: #dce5d2; color: #19382f; }
.account span, .account small { font-size: 9px; letter-spacing: 1.5px; } .account h2 { font-size: 29px; margin: 22px 0 15px; letter-spacing: -1px; }
.transfer { margin-top: 20px; padding: 24px; background: white; border: 1px solid #dbe0d7; border-radius: 10px; }
h3 { margin: 0 0 8px; font-size: 16px; } .transfer p { font-size: 12px; }
label { display: block; color: #5d7064; font-size: 11px; margin-top: 20px; }
input { display: block; width: 100%; border: 1px solid #d6dfd3; padding: 13px; border-radius: 5px; margin: 8px 0 14px; font-size: 20px; color: #183e31; }
button { border: 0; border-radius: 5px; padding: 13px 22px; background: #c9eb9d; color: #173a2d; font-weight: 700; cursor: pointer; } button:hover { background: #b8df83; }
.error { color: #b22c2c; } .transactions { padding: 24px 0; } .transactions > div { display: flex; justify-content: space-between; padding: 15px 0; border-bottom: 1px solid #d6dfd3; font-size: 12px; }
footer { font-size: 8px; letter-spacing: 1px; color: #7f9185; margin-top: 24px; }
@media (max-width: 450px) { .bank { padding: 18px; } .accounts { grid-template-columns: 1fr; } h1 { font-size: 29px; } header > span { font-size: 7px; } }
`,
  "tests/ledger.test.js": `// These tests execute against the edited App.jsx exports in the sandbox.
test('moves funds between two accounts', () => {
  const result = transfer({ primary: 10000, savings: 5000 }, 'primary', 'savings', 2500);
  assert.equal(result.primary, 7500);
  assert.equal(result.savings, 7500);
});

test('rejects overdrafts and preserves non-negative balances', () => {
  assert.throws(() => transfer({ primary: 100, savings: 0 }, 'primary', 'savings', 101));
});

test('conserves total funds without mutating the input', () => {
  const before = { primary: 10000, savings: 5000 };
  const after = transfer(before, 'primary', 'savings', 1);
  assert.equal(after.primary + after.savings, 15000);
  assert.equal(before.primary, 10000);
});

test('rejects zero, negative, fractional and invalid transfers', () => {
  assert.equal(parseAmount('0.29'), 29);
  assert.equal(parseAmount('10.15'), 1015);
  assert.throws(() => parseAmount('1.001'));
  assert.throws(() => parseAmount('-1.00'));
  assert.throws(() => parseAmount(''));
  for (const amount of [0, -1, 0.1, NaN, Infinity])
    assert.throws(() => transfer({ primary: 100, savings: 0 }, 'primary', 'savings', amount));
  assert.throws(() => transfer({ primary: 100 }, 'primary', 'missing', 1));
  assert.throws(() => transfer({ primary: 100 }, 'primary', 'primary', 1));
});
`,
};
