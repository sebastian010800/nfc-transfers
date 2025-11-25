// src/App.tsx
import { Container } from "@mantine/core";
import { Routes, Route, Navigate } from "react-router-dom";

import AdminLayout from "./pages/admin"; // layout
import UsersPage from "./pages/admin/users"; // tu admin de usuarios
import ProductsPage from "./pages/admin/product";
import ExperiencesPage from "./pages/admin/experiences";

import BarmanPage from "./pages/barman";
import HostPage from "./pages/host";
import PageUser from "./pages/PageUser"; // 👈 NUEVO
import TransactionsPage from "./pages/admin/transactions";
import GaleryAdminPage from "./pages/admin/galery";
import Gallery from "./pages/GaleryPage"; // 👈 NUEVO
export default function App() {
  return (
    <Container fluid p={0}>
      <Routes>
        <Route path="/" element={<Navigate to="/host" replace />} />
        <Route path="/barman" element={<BarmanPage />} />
        <Route path="/host" element={<HostPage />} />
        <Route path="/user" element={<PageUser />} /> {/* 👈 NUEVO */}
        <Route path="/galery/:id" element={<Gallery />} /> {/* 👈 NUEVO */}
        {/* Admin layout + nested routes */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="users" replace />} />
          <Route path="users" element={<UsersPage />} />
          <Route path="products" element={<ProductsPage />} />
          <Route path="experiences" element={<ExperiencesPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="galery" element={<GaleryAdminPage />} />
        </Route>
      </Routes>
    </Container>
  );
}
