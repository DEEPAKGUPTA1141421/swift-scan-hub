import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { WarehouseProvider } from "@/context/WarehouseContext";
import Index from "./pages/Index";
import Login from "./pages/Login";
import SelectWarehouse from "./pages/SelectWarehouse";
import Dashboard from "./pages/Dashboard";
import ReceiveOrders from "./pages/ReceiveOrders";
import CreateParcel from "./pages/CreateParcel";
import Dispatch from "./pages/Dispatch";
import ReceiveParcel from "./pages/ReceiveParcel";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <WarehouseProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/select-warehouse" element={<SelectWarehouse />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/receive-orders" element={<ReceiveOrders />} />
            <Route path="/create-parcel" element={<CreateParcel />} />
            <Route path="/dispatch" element={<Dispatch />} />
            <Route path="/receive-parcel" element={<ReceiveParcel />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </WarehouseProvider>
  </QueryClientProvider>
);

export default App;
