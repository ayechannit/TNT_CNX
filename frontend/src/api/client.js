import { getToken, clearAuth } from "../lib/authStorage";
import { beginRequest, endRequest } from "./loadingBus";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000/api";

// Coalesce identical concurrent calls (e.g. a "Mark Paid" button double-clicked
// before the first response lands) into a single in-flight request, so a
// double-click can't create duplicate records. Keyed on method+path+body, so
// it never blocks unrelated requests - only an exact repeat while pending.
const inflightRequests = new Map();

async function request(path, options = {}) {
  const method = (options.method || "GET").toUpperCase();
  const key = `${method} ${path} ${options.body || ""}`;
  if (inflightRequests.has(key)) {
    return inflightRequests.get(key);
  }

  const promise = (async () => {
    const token = getToken();
    beginRequest();
    try {
      const res = await fetch(`${BASE_URL}${path}`, {
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        ...options,
      });
      if (res.status === 401 && path !== "/auth/login") {
        clearAuth();
        window.dispatchEvent(new Event("mpos-auth-expired"));
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = (data.errors && data.errors.join(", ")) || data.error || "Request failed";
        throw new Error(message);
      }
      return data;
    } finally {
      endRequest();
    }
  })();

  inflightRequests.set(key, promise);
  try {
    return await promise;
  } finally {
    inflightRequests.delete(key);
  }
}

function toQuery(params) {
  const usp = new URLSearchParams();
  Object.entries(params || {}).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== "") usp.set(k, v);
  });
  const s = usp.toString();
  return s ? `?${s}` : "";
}

export const api = {
  login: (username, password) => request("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),

  getCategories: () => request("/categories?pageSize=1000").then((r) => r.data),
  searchStock: (params) => request(`/stock${toQuery(params)}`),
  getStockByBarcode: (barcode) => request(`/stock/barcode/${encodeURIComponent(barcode)}`),
  getStock: (id) => request(`/stock/${id}`),
  createStock: (body) => request("/stock", { method: "POST", body: JSON.stringify(body) }),
  updateStock: (id, body) => request(`/stock/${id}`, { method: "PUT", body: JSON.stringify(body) }),

  // Generic entity CRUD (Category, Supplier, Branch, ExpenseType, User) - Customer has its own page
  listEntity: (path, params) => request(`/${path}${toQuery(params)}`),
  getEntity: (path, id) => request(`/${path}/${id}`),
  createEntity: (path, body) => request(`/${path}`, { method: "POST", body: JSON.stringify(body) }),
  updateEntity: (path, id, body) => request(`/${path}/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteEntity: (path, id) => request(`/${path}/${id}`, { method: "DELETE" }),

  getUserRoles: (userId) => request(`/user-roles/${userId}`),
  setUserRoles: (userId, formnames) =>
    request(`/user-roles/${userId}`, { method: "PUT", body: JSON.stringify({ formnames }) }),

  listSales: (params) => request(`/sales${toQuery(params)}`),
  getSale: (id) => request(`/sales/${id}`),
  createSale: (body) => request("/sales", { method: "POST", body: JSON.stringify(body) }),
  updateSale: (id, body) => request(`/sales/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  markSalePaid: (id) => request(`/sales/${id}/mark-paid`, { method: "POST", body: JSON.stringify({}) }),
  undoSalePaid: (id) => request(`/sales/${id}/undo-paid`, { method: "POST", body: JSON.stringify({}) }),
  markSaleDelivered: (id) => request(`/sales/${id}/mark-delivered`, { method: "POST", body: JSON.stringify({}) }),
  deleteSale: (id) => request(`/sales/${id}`, { method: "DELETE" }),

  listPurchases: (params) => request(`/purchases${toQuery(params)}`),
  getPurchase: (id) => request(`/purchases/${id}`),
  createPurchase: (body) => request("/purchases", { method: "POST", body: JSON.stringify(body) }),
  updatePurchase: (id, body) => request(`/purchases/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  markPurchasePaid: (id) => request(`/purchases/${id}/mark-paid`, { method: "POST", body: JSON.stringify({}) }),
  deletePurchase: (id) => request(`/purchases/${id}`, { method: "DELETE" }),

  listStockAdjustments: (params) => request(`/stock-adjustments${toQuery(params)}`),
  getStockBalance: (stockId, branchId) => request(`/stock-adjustments/balance/${stockId}?branchId=${branchId}`),
  createStockAdjustment: (body) => request("/stock-adjustments", { method: "POST", body: JSON.stringify(body) }),

  listExpenses: (params) => request(`/expenses${toQuery(params)}`),
  createExpense: (body) => request("/expenses", { method: "POST", body: JSON.stringify(body) }),
  updateExpense: (id, body) => request(`/expenses/${id}`, { method: "PUT", body: JSON.stringify(body) }),
  deleteExpense: (id) => request(`/expenses/${id}`, { method: "DELETE" }),

  listTransfers: (params) => request(`/transfers${toQuery(params)}`),
  getTransfer: (id) => request(`/transfers/${id}`),
  createTransfer: (body) => request("/transfers", { method: "POST", body: JSON.stringify(body) }),
  receiveTransfer: (id) => request(`/transfers/${id}/receive`, { method: "POST", body: JSON.stringify({}) }),
  deleteTransfer: (id) => request(`/transfers/${id}`, { method: "DELETE" }),

  listReturns: (params) => request(`/returns${toQuery(params)}`),
  getReturn: (id) => request(`/returns/${id}`),
  createReturn: (body) => request("/returns", { method: "POST", body: JSON.stringify(body) }),
  deleteReturn: (id) => request(`/returns/${id}`, { method: "DELETE" }),

  listSaleReturns: (params) => request(`/sale-returns${toQuery(params)}`),
  getSaleReturn: (id) => request(`/sale-returns/${id}`),
  createSaleReturn: (body) => request("/sale-returns", { method: "POST", body: JSON.stringify(body) }),
  deleteSaleReturn: (id) => request(`/sale-returns/${id}`, { method: "DELETE" }),

  listReports: () => request("/reports").then((r) => r.data),
  runReport: (key, params) => request(`/reports/${key}${toQuery(params)}`).then((r) => r.data),
};
