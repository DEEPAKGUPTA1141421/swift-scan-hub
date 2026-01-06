import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Package, PackagePlus, Truck, PackageCheck, Clock, Send } from 'lucide-react';
import { useWarehouse } from '@/context/WarehouseContext';
import { Layout } from '@/components/Layout';
import { MetricCard } from '@/components/MetricCard';
import { ActionCard } from '@/components/ActionCard';

export default function Dashboard() {
  const { user, currentWarehouse, getDashboardStats } = useWarehouse();
  const navigate = useNavigate();
  const stats = getDashboardStats();

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
            Welcome back, {user.email.split('@')[0]}
          </p>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            title="Orders Received Today"
            value={stats.ordersReceivedToday}
            icon={PackageCheck}
          />
          <MetricCard
            title="Waiting for Bagging"
            value={stats.ordersWaitingForBagging}
            icon={Clock}
          />
          <MetricCard
            title="Ready to Dispatch"
            value={stats.parcelsReadyToDispatch}
            icon={Send}
          />
        </div>

        {/* Quick Actions */}
        <div>
          <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
          <div className="grid gap-4">
            <ActionCard
              title="Receive Orders"
              description="Scan order QR codes from riders"
              icon={Package}
              to="/receive-orders"
              variant="primary"
            />
            <ActionCard
              title="Create Parcel"
              description="Bag orders for dispatch"
              icon={PackagePlus}
              to="/create-parcel"
            />
            <ActionCard
              title="Dispatch Parcel"
              description="Send parcels to riders/vehicles"
              icon={Truck}
              to="/dispatch"
            />
            <ActionCard
              title="Receive Parcel"
              description="Accept parcels from other warehouses"
              icon={PackageCheck}
              to="/receive-parcel"
            />
          </div>
        </div>
      </div>
    </Layout>
  );
}
