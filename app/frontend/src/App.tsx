import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import Transactions from './pages/Transactions';
import Members from './pages/Members';
import Reports from './pages/Reports';
import ScheduledTransactions from './pages/ScheduledTransactions';
import ReceiptUpload from './pages/ReceiptUpload';
import './App.css';

const navItems = [
  { to: '/', label: 'ホーム', icon: '🏠' },
  { to: '/transactions', label: '収支', icon: '💴' },
  { to: '/reports', label: 'レポート', icon: '📊' },
  { to: '/members', label: 'メンバー・カテゴリ', icon: '👥' },
  { to: '/scheduled-transactions', label: '固定費', icon: '📅' },
  { to: '/receipts', label: 'レシート', icon: '🧾' },
];

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-layout">
        {/* Desktop Sidebar */}
        <aside className="sidebar">
          <div className="sidebar-header">
            <span className="sidebar-logo">💰</span>
            <span className="sidebar-title">家計簿</span>
          </div>
          <nav className="sidebar-nav">
            {navItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}
              >
                <span className="nav-icon">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <main className="main-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/transactions" element={<Transactions />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/members" element={<Members />} />
            <Route path="/scheduled-transactions" element={<ScheduledTransactions />} />
            <Route path="/receipts" element={<ReceiptUpload />} />
          </Routes>
        </main>

        {/* Mobile Bottom Nav */}
        <nav className="bottom-nav">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </NavLink>
          ))}
        </nav>
      </div>
    </BrowserRouter>
  );
}
