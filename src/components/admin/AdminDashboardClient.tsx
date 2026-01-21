'use client';

import { useEffect, useState } from 'react';
import { User } from '@/types/chat';
import { Trash2, UserPlus, LogOut } from 'lucide-react';
import ConversationList from '@/components/admin/ConversationList';
import apiClient from '@/lib/api';

export default function AdminDashboardClient() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminEmail, setAdminEmail] = useState('');
  const [makeAdminMessage, setMakeAdminMessage] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserPassword, setNewUserPassword] = useState('');
  const [newUserName, setNewUserName] = useState('');
  const [addUserMessage, setAddUserMessage] = useState('');

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const res = await apiClient.adminGetUsers();
      if (res.success && res.data) {
        setUsers(res.data);
      } else {
        throw new Error(typeof res.error === 'string' ? res.error : 'Unknown error');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    if (confirm('Are you sure you want to delete this user?')) {
      try {
        const res = await apiClient.deleteUser(userId);
        if (res.success) {
          setUsers(users.filter(user => user._id !== userId));
        } else {
          const errorMsg = typeof res.error === 'string' ? res.error : 'Failed to delete user';
          alert(errorMsg);
        }
      } catch (err) {
        alert((err as Error).message);
      }
    }
  };

  const handleMakeAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEmail) {
      setMakeAdminMessage('Please enter an email.');
      return;
    }
    setMakeAdminMessage('');
    try {
      const res = await apiClient.makeAdmin(adminEmail);
      if (res.success) {
        setMakeAdminMessage('User is now an admin');
        setAdminEmail('');
        alert('User is now an admin. They must re-login to obtain admin privileges.');
      } else {
        const errorMsg = typeof res.error === 'string' ? res.error : 'Failed to make user admin';
        setMakeAdminMessage(errorMsg);
      }
    } catch (err) {
      setMakeAdminMessage((err as Error).message);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserEmail || !newUserPassword || !newUserName) {
      setAddUserMessage('Please enter name, email and password.');
      return;
    }
    setAddUserMessage('');
    try {
      const res = await apiClient.signup(newUserEmail, newUserPassword, newUserName);
      if (res.success) {
        setAddUserMessage('User created successfully.');
        setNewUserEmail('');
        setNewUserPassword('');
        setNewUserName('');
        fetchUsers();
      } else {
        const errorMsg = typeof res.error === 'string' ? res.error : 'Failed to create user';
        setAddUserMessage(errorMsg);
      }
    } catch (err) {
      setAddUserMessage((err as Error).message);
    }
  };

  const handleLogout = async () => {
    try {
      await apiClient.logout();
    } finally {
      // redirect to login page
      window.location.href = '/8369746981/login';
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  return (
    <div className="container mx-auto p-4 bg-[var(--bg-tertiary)] text-[var(--text-primary)] min-h-screen">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-[var(--accent-primary)]">Admin Panel</h1>
        <div className="flex items-center space-x-2">
          <button onClick={handleLogout} className="btn-ghost flex items-center">
            <LogOut size={18} className="mr-2" /> Logout
          </button>
        </div>
      </div>

      <div className="bg-[var(--bg-secondary)] p-6 rounded-lg shadow-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-[var(--text-primary)]">Users</h2>
        </div>

        {isLoading && <p>Loading users...</p>}
        {error && <p className="text-red-500">Error: {error}</p>}
        {!isLoading && !error && (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr>
                  <th className="py-2 px-4 border-b border-[var(--border-primary)] text-left text-[var(--text-secondary)]">Name</th>
                  <th className="py-2 px-4 border-b border-[var(--border-primary)] text-left text-[var(--text-secondary)]">Email</th>
                  <th className="py-2 px-4 border-b border-[var(--border-primary)] text-left text-[var(--text-secondary)]">Status</th>
                  <th className="py-2 px-4 border-b border-[var(--border-primary)] text-left text-[var(--text-secondary)]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map(user => (
                  <tr key={user._id} className="hover:bg-[var(--bg-hover)]">
                    <td className="py-2 px-4 border-b border-[var(--border-primary)]">{user.name}</td>
                    <td className="py-2 px-4 border-b border-[var(--border-primary)]">{user.email}</td>
                    <td className="py-2 px-4 border-b border-[var(--border-primary)] capitalize">{user.status}</td>
                    <td className="py-2 px-4 border-b border-[var(--border-primary)]">
                      <button onClick={() => handleDeleteUser(user._id)} className="text-red-500 hover:text-red-400">
                        <Trash2 size={20} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-[var(--bg-secondary)] p-6 rounded-lg shadow-md mt-8">
        <h2 className="text-xl font-semibold mb-4 text-[var(--text-primary)]">Add User</h2>
        <form onSubmit={handleAddUser} className="flex flex-col space-y-4">
          <input
            type="text"
            value={newUserName}
            onChange={(e) => setNewUserName(e.target.value)}
            placeholder="User Name"
            className="input-chat"
          />
          <input
            type="email"
            value={newUserEmail}
            onChange={(e) => setNewUserEmail(e.target.value)}
            placeholder="User email"
            className="input-chat"
          />
          <input
            type="password"
            value={newUserPassword}
            onChange={(e) => setNewUserPassword(e.target.value)}
            placeholder="Password"
            className="input-chat"
          />
          <button type="submit" className="btn-primary">
            <UserPlus size={20} className="mr-2 inline-block" />
            Add User
          </button>
        </form>
        {addUserMessage && <p className="mt-2 text-[var(--accent-primary)]">{addUserMessage}</p>}
      </div>

      <div className="bg-[var(--bg-secondary)] p-6 rounded-lg shadow-md mt-8">
        <h2 className="text-xl font-semibold mb-4 text-[var(--text-primary)]">Make Admin</h2>
        <form onSubmit={handleMakeAdmin} className="flex items-center">
          <input
            type="email"
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            placeholder="User email"
            className="input-chat flex-grow mr-2"
          />
          <button type="submit" className="btn-primary">Make Admin</button>
        </form>
        {makeAdminMessage && <p className="mt-2 text-[var(--accent-primary)]">{makeAdminMessage}</p>}
      </div>

      <ConversationList />
    </div>
  );
}
