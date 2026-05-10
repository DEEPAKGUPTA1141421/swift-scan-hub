import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Clock,
  Map,
  MapPin,
  Package,
  PackageCheck,
  PackagePlus,
  Send,
  TrendingUp,
  Truck,
  Users,
  Warehouse as WarehouseIcon,
} from 'lucide-react';
import { useWarehouse } from '@/context/WarehouseContext';
import { Layout } from '@/components/Layout';
import { MetricCard } from '@/components/MetricCard';
import { ActionCard } from '@/components/ActionCard';

export default function Dashboard() {
  const { user, currentWarehouse, getDashboardStats, dashboardStats, isLoadingData } = useWarehouse();
  const navigate = useNavigate();
  const stats = dashboardStats ?? getDashboardStats();
  const warehouseName = stats.warehouseName ?? currentWarehouse?.name;
  const warehouseCity = stats.city ?? currentWarehouse?.city;
  const isDashboardLoading = isLoadingData && !dashboardStats;

  useEffect(() => {
    if (!user) {
      navigate('/login');
    } else if (!currentWarehouse) {
      navigate('/select-warehouse');
    }
  }, [user, currentWarehouse, navigate]);

  if (!user || !currentWarehouse) return null;

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back, {user.email.split('@')[0]} - {warehouseName}, {warehouseCity}
          </p>
        </div>

        {isDashboardLoading ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground animate-pulse">Loading dashboard metrics...</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="h-28 rounded-xl border border-dashed border-muted-foreground/20 bg-muted/10 animate-pulse" />
              <div className="h-28 rounded-xl border border-dashed border-muted-foreground/20 bg-muted/10 animate-pulse" />
              <div className="h-28 rounded-xl border border-dashed border-muted-foreground/20 bg-muted/10 animate-pulse" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="h-28 rounded-xl border border-dashed border-muted-foreground/20 bg-muted/10 animate-pulse" />
              <div className="h-28 rounded-xl border border-dashed border-muted-foreground/20 bg-muted/10 animate-pulse" />
              <div className="h-28 rounded-xl border border-dashed border-muted-foreground/20 bg-muted/10 animate-pulse" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="h-28 rounded-xl border border-dashed border-muted-foreground/20 bg-muted/10 animate-pulse" />
            </div>
          </div>
        ) : (
          <>
            {/* Parcel metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MetricCard
                title="Parcels Created"
                value={stats.parcelsCreated ?? 0}
                icon={PackagePlus}
              />
              <MetricCard
                title="Awaiting Pickup"
                value={stats.parcelsAwaitingPickup ?? 0}
                icon={Clock}
              />
              <MetricCard
                title="At Warehouse"
                value={stats.parcelsAtWarehouse ?? stats.ordersReceivedToday}
                icon={PackageCheck}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MetricCard
                title="In Shipment"
                value={stats.parcelsInShipment ?? stats.ordersWaitingForBagging}
                icon={Send}
              />
              <MetricCard
                title="Out for Delivery"
                value={stats.parcelsOutForDelivery ?? 0}
                icon={Truck}
              />
              <MetricCard
                title="Delivered"
                value={stats.parcelsDelivered ?? 0}
                icon={TrendingUp}
              />
            </div>

            {/* Shipment and rider metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MetricCard
                title="Shipments Created"
                value={stats.shipmentsCreated ?? stats.parcelsReadyToDispatch}
                icon={WarehouseIcon}
              />
              <MetricCard
                title="Shipments In Transit"
                value={stats.shipmentsInTransit ?? stats.parcelsInTransit ?? 0}
                icon={Truck}
              />
              <MetricCard
                title="Shipments Arrived"
                value={stats.shipmentsArrived ?? 0}
                icon={PackageCheck}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <MetricCard
                title="Active Riders"
                value={stats.activeRiders ?? 20}
                icon={Users}
              />
            </div>
          </>
        )}

        {/* Quick Actions */}
        <div>
          <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
          <div className="grid gap-4">
            <ActionCard
              title="Receive Orders"
              description="Scan parcel QR codes from riders arriving at warehouse"
              icon={Package}
              to="/receive-orders"
              variant="primary"
            />
            <ActionCard
              title="Create Shipment"
              description="Bag parcels into a shipment for dispatch"
              icon={PackagePlus}
              to="/create-parcel"
            />
            <ActionCard
              title="Dispatch Shipment"
              description="Send shipments to riders / vehicles"
              icon={Truck}
              to="/dispatch"
            />
            <ActionCard
              title="Receive Shipment"
              description="Accept incoming shipments from other warehouses"
              icon={PackageCheck}
              to="/receive-parcel"
            />
            <ActionCard
              title="Live Delivery Map"
              description="Real-time rider positions, stop progress, and VRP dispatch"
              icon={Map}
              to="/dashboard/live"
            />
            <ActionCard
              title="Service Zones"
              description="Draw and manage delivery coverage areas for users and sellers"
              icon={MapPin}
              to="/zone-manager"
            />
          </div>
        </div>
      </div>
    </Layout>
  );
}
