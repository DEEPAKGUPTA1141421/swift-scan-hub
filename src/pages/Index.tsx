import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useWarehouse } from '@/context/WarehouseContext';

const Index = () => {
  const navigate = useNavigate();
  const { user, currentWarehouse } = useWarehouse();

  useEffect(() => {
    if (!user) {
      navigate('/login');
    } else if (!currentWarehouse) {
      navigate('/select-warehouse');
    } else {
      navigate('/dashboard');
    }
  }, [user, currentWarehouse, navigate]);

  return null;
};

export default Index;
