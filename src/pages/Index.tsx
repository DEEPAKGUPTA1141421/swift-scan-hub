import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWarehouse } from '@/context/WarehouseContext';

const Index = () => {
  const navigate = useNavigate();
  const { user, currentWarehouse, isLoadingWarehouses } = useWarehouse();

  useEffect(() => {
    if (!user) {
      navigate('/login');
    } else if (currentWarehouse) {
      navigate('/dashboard');
    } else if (!isLoadingWarehouses) {
      navigate('/select-warehouse');
    }
  }, [user, currentWarehouse, isLoadingWarehouses, navigate]);

  return null;
};

export default Index;
