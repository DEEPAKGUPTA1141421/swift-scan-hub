import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Warehouse, LogIn } from 'lucide-react';
import { useWarehouse } from '@/context/WarehouseContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useWarehouse();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      toast.error('Please enter email and password');
      return;
    }

    setIsLoading(true);
    
    try {
      const success = await login(email, password);
      if (success) {
        toast.success('Login successful');
        navigate('/select-warehouse');
      } else {
        toast.error('Invalid credentials');
      }
    } catch {
      toast.error('Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex p-4 bg-primary rounded-2xl mb-4">
            <Warehouse className="w-12 h-12 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold">Warehouse Ops</h1>
          <p className="text-muted-foreground mt-2">Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-card border border-border rounded-2xl p-8 shadow-sm">
          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-base">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="operator@warehouse.com"
                className="h-12 text-base"
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-base">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="h-12 text-base"
                autoComplete="current-password"
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-14 text-lg font-semibold"
            >
              {isLoading ? (
                'Signing in...'
              ) : (
                <>
                  <LogIn className="w-5 h-5 mr-2" />
                  Login
                </>
              )}
            </Button>
          </div>
        </form>

        <p className="text-center text-sm text-muted-foreground mt-6">
          Demo: Use any email/password to sign in
        </p>
      </div>
    </div>
  );
}
