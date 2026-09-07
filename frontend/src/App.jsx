import { useEffect, useState } from "react";
import StockPage from "./pages/StockPage";
import SalePage from "./pages/SalePage";
import PurchasePage from "./pages/PurchasePage";
import StockAdjustmentPage from "./pages/StockAdjustmentPage";
import TransferPage from "./pages/TransferPage";
import ReturnPage from "./pages/ReturnPage";
import SaleReturnPage from "./pages/SaleReturnPage";
import ReportsPage from "./pages/ReportsPage";
import CategoryPage from "./pages/CategoryPage";
import SupplierPage from "./pages/SupplierPage";
import CustomerPage from "./pages/CustomerPage";
import BranchPage from "./pages/BranchPage";
import ExpenseTypePage from "./pages/ExpenseTypePage";
import UserPage from "./pages/UserPage";
import UserRolePage from "./pages/UserRolePage";
import LoginPage from "./pages/LoginPage";
import { getToken, getStoredUser, setAuth as persistAuth, clearAuth } from "./lib/authStorage";
import tntLogo from "./assets/tnt-logo.png";
import "./App.css";

// Grouped into categories so the nav scales past a dozen-plus screens
// without overflowing or hiding items on smaller windows - see each
// category's tab row rendered below the category row in the header.
const CATEGORIES = [
  {
    key: "transactions",
    label: "Transactions",
    tabs: [
      { key: "sale", label: "Sale", component: SalePage },
      { key: "purchase", label: "Purchase", component: PurchasePage },
      { key: "stockAdjustment", label: "Stock Adjustment", component: StockAdjustmentPage },
      { key: "transfer", label: "Transfer", component: TransferPage },
      { key: "return", label: "Return", component: ReturnPage },
      { key: "saleReturn", label: "Sale Return", component: SaleReturnPage },
    ],
  },
  {
    key: "inventory",
    label: "Inventory",
    tabs: [
      { key: "stock", label: "Stock", component: StockPage },
      { key: "category", label: "Category", component: CategoryPage },
      { key: "supplier", label: "Supplier", component: SupplierPage },
    ],
  },
  {
    key: "people",
    label: "People",
    tabs: [
      { key: "customer", label: "Customer", component: CustomerPage },
      { key: "user", label: "Users", component: UserPage },
      { key: "userRole", label: "User Roles", component: UserRolePage },
    ],
  },
  {
    key: "setup",
    label: "Setup",
    tabs: [
      { key: "branch", label: "Branch", component: BranchPage },
      { key: "expenseType", label: "Expense Type", component: ExpenseTypePage },
    ],
  },
  {
    key: "reports",
    label: "Reports",
    tabs: [
      { key: "reports", label: "Reports", component: ReportsPage },
    ],
  },
];

const ALL_TABS = CATEGORIES.flatMap((c) => c.tabs);
const DEFAULT_TAB = "sale"; // the screen used all day, every day - not an admin/setup screen
const LAST_TAB_KEY = "mpos-last-tab";

function getInitialTab() {
  try {
    const saved = localStorage.getItem(LAST_TAB_KEY);
    if (saved && ALL_TABS.some((t) => t.key === saved)) return saved;
  } catch {
    // localStorage unavailable (private browsing, etc.) - fall through to default.
  }
  return DEFAULT_TAB;
}

function App() {
  const [activeTab, setActiveTab] = useState(getInitialTab);
  const [menuOpen, setMenuOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState(() => {
    const token = getToken();
    const user = getStoredUser();
    return token && user ? user : null;
  });

  useEffect(() => {
    try {
      localStorage.setItem(LAST_TAB_KEY, activeTab);
    } catch {
      // ignore - per-browser convenience only, not required for correctness.
    }
  }, [activeTab]);

  useEffect(() => {
    function onAuthExpired() {
      setCurrentUser(null);
    }
    window.addEventListener("mpos-auth-expired", onAuthExpired);
    return () => window.removeEventListener("mpos-auth-expired", onAuthExpired);
  }, []);

  function handleLogin(result) {
    persistAuth(result.token, result.user);
    setCurrentUser(result.user);
  }

  function handleLogout() {
    clearAuth();
    setCurrentUser(null);
  }

  if (!currentUser) {
    return <LoginPage onLogin={handleLogin} />;
  }

  const activeCategory = CATEGORIES.find((c) => c.tabs.some((t) => t.key === activeTab)) || CATEGORIES[0];
  const ActiveComponent = ALL_TABS.find((t) => t.key === activeTab)?.component || StockPage;

  function selectCategory(categoryKey) {
    const cat = CATEGORIES.find((c) => c.key === categoryKey);
    if (cat) setActiveTab(cat.tabs[0].key);
  }

  function selectTab(tabKey) {
    setActiveTab(tabKey);
    setMenuOpen(false);
  }

  return (
    <>
      <header className="app-header">
        <img src={tntLogo} alt="TNT" className="app-logo" />
        <h1>MPOS</h1>
        <div className="app-user-info">
          <span className="app-user-name">{currentUser.realName}</span>
          <button className="app-logout-btn" onClick={handleLogout}>Logout</button>
        </div>
        <button
          className="app-menu-toggle"
          aria-label="Toggle menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span /><span /><span />
        </button>
        <nav className={`app-nav-wrap ${menuOpen ? "open" : ""}`}>
          <div className="app-nav-categories">
            {CATEGORIES.map((c) => (
              <button
                key={c.key}
                className={activeCategory.key === c.key ? "active" : ""}
                onClick={() => selectCategory(c.key)}
              >
                {c.label}
              </button>
            ))}
          </div>
          <div className="app-nav-tabs">
            {activeCategory.tabs.map((t) => (
              <button
                key={t.key}
                className={activeTab === t.key ? "active" : ""}
                onClick={() => selectTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </nav>
      </header>
      <ActiveComponent />
    </>
  );
}

export default App;
