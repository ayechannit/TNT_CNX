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
import ExpensePage from "./pages/ExpensePage";
import UserPage from "./pages/UserPage";
import UserRolePage from "./pages/UserRolePage";
import LoginPage from "./pages/LoginPage";
import GlobalLoadingBar from "./components/GlobalLoadingBar";
import { getToken, getStoredUser, setAuth as persistAuth, clearAuth, getPermissions, isSuperuser } from "./lib/authStorage";
import tntLogo from "./assets/tnt-logo.png";
import "./App.css";

// Grouped into categories so the nav scales past a dozen-plus screens
// without overflowing or hiding items on smaller windows - see each
// category's tab row rendered below the category row in the header.
// `perm` lists the UserRole formname(s) that grant a tab; a user sees the tab
// if they hold ANY of them. Unrestricted users see every tab (see
// visibleCategoriesFor).
const CATEGORIES = [
  {
    key: "transactions",
    label: "Transactions",
    tabs: [
      { key: "sale", label: "Sale", component: SalePage, perm: ["FrmSale", "FrmSaleList"] },
      { key: "purchase", label: "Purchase", component: PurchasePage, perm: ["FrmPurchase", "FrmPurchaseList"] },
      { key: "stockAdjustment", label: "Stock Adjustment", component: StockAdjustmentPage, perm: ["FrmStockAdjust"] },
      { key: "transfer", label: "Transfer", component: TransferPage, perm: ["FrmTransfer", "FrmTransferList"] },
      { key: "return", label: "Return", component: ReturnPage, perm: ["FrmReturn", "FrmReturnList"] },
      { key: "saleReturn", label: "Sale Return", component: SaleReturnPage, perm: ["FrmSaleReturn", "FrmSaleReturnList"] },
      { key: "expense", label: "Expense", component: ExpensePage, perm: ["FrmExpense"] },
    ],
  },
  {
    key: "inventory",
    label: "Inventory",
    tabs: [
      { key: "stock", label: "Stock", component: StockPage, perm: ["FrmStock", "FrmStockBalance"] },
      { key: "category", label: "Category", component: CategoryPage, perm: ["FrmCategory"] },
      { key: "supplier", label: "Supplier", component: SupplierPage, perm: ["FrmSupplier"] },
    ],
  },
  {
    key: "people",
    label: "People",
    tabs: [
      { key: "customer", label: "Customer", component: CustomerPage, perm: ["FrmCustomer"] },
      { key: "user", label: "Users", component: UserPage, perm: ["FrmUser"] },
      { key: "userRole", label: "User Roles", component: UserRolePage, perm: ["FrmUserRole"] },
    ],
  },
  {
    key: "setup",
    label: "Setup",
    tabs: [
      { key: "branch", label: "Branch", component: BranchPage, perm: ["FrmBranch"] },
      { key: "expenseType", label: "Expense Type", component: ExpenseTypePage, perm: ["FrmExpenseType"] },
    ],
  },
  {
    key: "reports",
    label: "Reports",
    tabs: [
      { key: "reports", label: "Reports", component: ReportsPage, perm: ["FrmReport", "FrmSaleReport", "FrmPurchaseReport"] },
    ],
  },
];

const ALL_TABS = CATEGORIES.flatMap((c) => c.tabs);

// Every formname that gates a screen. A user who holds none of these is treated
// as unrestricted (full access) - this is how the legacy "admin" account, which
// has zero UserRole rows, keeps seeing everything.
const ALL_SCREEN_PERMS = new Set(ALL_TABS.flatMap((t) => t.perm || []));

// Categories (and their tabs) the given permission list may see. Unrestricted
// users see all tabs; restricted users see only tabs whose `perm` they hold.
// Empty categories are dropped so no bare category button is left behind.
function visibleCategoriesFor(permissions) {
  const held = new Set(permissions || []);
  const unrestricted = isSuperuser() || ![...ALL_SCREEN_PERMS].some((p) => held.has(p));
  return CATEGORIES.map((cat) => ({
    ...cat,
    tabs: cat.tabs.filter(
      (t) => unrestricted || (t.perm && t.perm.some((p) => held.has(p)))
    ),
  })).filter((cat) => cat.tabs.length > 0);
}
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

  // If the active tab isn't one this user is allowed to see (e.g. a restricted
  // user whose last-used tab was an admin screen), snap to their first visible
  // tab so they never land on a hidden screen.
  useEffect(() => {
    const visibleTabs = visibleCategoriesFor(getPermissions()).flatMap((c) => c.tabs);
    if (visibleTabs.length && !visibleTabs.some((t) => t.key === activeTab)) {
      setActiveTab(visibleTabs[0].key);
    }
  }, [currentUser, activeTab]);

  function handleLogin(result) {
    persistAuth(result.token, result.user, result.formNames);
    setCurrentUser(result.user);
  }

  function handleLogout() {
    clearAuth();
    setCurrentUser(null);
  }

  if (!currentUser) {
    return (
      <>
        <GlobalLoadingBar />
        <LoginPage onLogin={handleLogin} />
      </>
    );
  }

  const visibleCategories = visibleCategoriesFor(getPermissions());
  const allVisibleTabs = visibleCategories.flatMap((c) => c.tabs);
  const activeCategory = visibleCategories.find((c) => c.tabs.some((t) => t.key === activeTab)) || visibleCategories[0];
  const ActiveComponent = allVisibleTabs.find((t) => t.key === activeTab)?.component || allVisibleTabs[0]?.component || StockPage;

  function selectCategory(categoryKey) {
    const cat = visibleCategories.find((c) => c.key === categoryKey);
    if (cat) setActiveTab(cat.tabs[0].key);
  }

  function selectTab(tabKey) {
    setActiveTab(tabKey);
    setMenuOpen(false);
  }

  return (
    <>
      <GlobalLoadingBar />
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
            {visibleCategories.map((c) => (
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
