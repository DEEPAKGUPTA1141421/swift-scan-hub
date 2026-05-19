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
import LiveMapDashboard from "./pages/LiveMapDashboard";
import ZoneManager from "./pages/ZoneManager";
import WarehouseOps from "./pages/WarehouseOps";
import Parcels from "./pages/Parcels";
import Shipments from "./pages/Shipments";
import Riders from "./pages/Riders";
import BatchReceive from "./pages/BatchReceive";
import ShipmentPlanning from "./pages/ShipmentPlanning";
import DispatchShipment from "./pages/DispatchShipment";

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
            <Route path="/dashboard/live" element={<LiveMapDashboard />} />
            <Route path="/zone-manager" element={<ZoneManager />} />
            <Route path="/warehouse-ops" element={<WarehouseOps />} />
            <Route path="/parcels" element={<Parcels />} />
            <Route path="/shipments" element={<Shipments />} />
            <Route path="/riders" element={<Riders />} />
            <Route path="/batch-receive" element={<BatchReceive />} />
            <Route path="/shipment-planning" element={<ShipmentPlanning />} />
            <Route path="/dispatch-shipment" element={<DispatchShipment />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </WarehouseProvider>
  </QueryClientProvider>
);

export default App;
