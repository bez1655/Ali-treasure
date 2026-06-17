import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SocketProvider } from "@/contexts/SocketContext";
import LoginPage from "@/pages/login";
import RoomsPage from "@/pages/rooms";
import RoomPage from "@/pages/room";

const queryClient = new QueryClient();

function ProtectedRoute({ component: Component, ...props }: { component: React.ComponentType<any>; [k: string]: any }) {
  const { user, isLoading } = useAuth();
  if (isLoading) return (
    <div style={{ minHeight: "100vh", backgroundColor: "#0B1426", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ fontSize: 32, color: "#D4A017" }}>⏳</div>
    </div>
  );
  if (!user) return <Redirect to="/login" />;
  return <Component {...props} />;
}

function AuthRoute() {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (user) return <Redirect to="/rooms" />;
  return <LoginPage />;
}

function AppRoutes() {
  const { token } = useAuth();
  return (
    <SocketProvider token={token}>
      <Switch>
        <Route path="/login" component={AuthRoute} />
        <Route path="/rooms">
          {() => <ProtectedRoute component={RoomsPage} />}
        </Route>
        <Route path="/room/:id">
          {(params) => <ProtectedRoute component={RoomPage} roomId={Number(params.id)} />}
        </Route>
        <Route path="/">
          {() => {
            const { user } = useAuth();
            return user ? <Redirect to="/rooms" /> : <Redirect to="/login" />;
          }}
        </Route>
      </Switch>
    </SocketProvider>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AppRoutes />
        </WouterRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
