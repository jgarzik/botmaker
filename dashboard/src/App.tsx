import { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { useBots } from './hooks/useBots';
import { Shell, Header, TabNav, type TabId } from './layout';
import { DashboardTab } from './dashboard';
import { DiagnosticsTab } from './diagnostics';
import { SecretsTab } from './secrets';
import { CreateWizard } from './wizard';
import LoginForm from './components/LoginForm';

export default function App() {
  const { isAuthenticated, isLoading: authLoading, login, logout, error: authError } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [showWizard, setShowWizard] = useState(false);

  const {
    bots,
    loading,
    actionLoading,
    error,
    handleCreate,
    handleStart,
    handleStop,
    handleDelete,
  } = useBots();

  // Show login form if not authenticated
  if (!isAuthenticated) {
    return <LoginForm onLogin={login} error={authError} isLoading={authLoading} />;
  }

  return (
    <Shell
      header={
        <>
          <Header onCreateClick={() => { setShowWizard(true); }} onLogout={() => { void logout(); }} />
          <TabNav activeTab={activeTab} onTabChange={setActiveTab} />
        </>
      }
    >
      {activeTab === 'dashboard' && (
        <DashboardTab
          bots={bots}
          loading={loading}
          actionLoading={actionLoading}
          error={error}
          onStart={(id) => { void handleStart(id); }}
          onStop={(id) => { void handleStop(id); }}
          onDelete={(id) => { void handleDelete(id); }}
          onCreateClick={() => { setShowWizard(true); }}
        />
      )}

      {activeTab === 'diagnostics' && <DiagnosticsTab />}

      {activeTab === 'secrets' && <SecretsTab />}

      {showWizard && (
        <CreateWizard
          onClose={() => { setShowWizard(false); }}
          onSubmit={handleCreate}
        />
      )}
    </Shell>
  );
}
