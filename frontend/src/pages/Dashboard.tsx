import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export const Dashboard: React.FC = () => {
  const { token, logout } = useAuth();
  const navigate = useNavigate();

  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProject, setSelectedProject] = useState<any>(null);
  const [rooms, setRooms] = useState<any[]>([]);

  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newProjectName, setNewProjectName] = useState('');
  const [newRoomName, setNewRoomName] = useState('');
  
  // State mời thành viên
  const [inviteInput, setInviteInput] = useState('');
  const [inviteMsg, setInviteMsg] = useState('');

  const axiosConfig = {
    headers: { Authorization: `Bearer ${token}` }
  };

  const fetchWorkspaces = async () => {
    try {
      const res = await axios.get('http://localhost:8080/api/v1/workspaces', axiosConfig);
      setWorkspaces(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  const selectWorkspace = async (ws: any) => {
    setSelectedWorkspace(ws);
    setSelectedProject(null);
    setRooms([]);
    setInviteMsg('');
    try {
      const res = await axios.get(`http://localhost:8080/api/v1/workspaces/${ws.id}/projects`, axiosConfig);
      setProjects(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const selectProject = async (pj: any) => {
    setSelectedProject(pj);
    try {
      const res = await axios.get(`http://localhost:8080/api/v1/projects/${pj.id}/rooms`, axiosConfig);
      setRooms(res.data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateWorkspace = async () => {
    if (!newWorkspaceName.trim()) return;
    try {
      await axios.post('http://localhost:8080/api/v1/workspaces', { name: newWorkspaceName }, axiosConfig);
      setNewWorkspaceName('');
      fetchWorkspaces();
    } catch (err) {
      alert('Không thể tạo Workspace');
    }
  };

  const handleCreateProject = async () => {
    if (!newProjectName.trim() || !selectedWorkspace) return;
    try {
      await axios.post(`http://localhost:8080/api/v1/workspaces/${selectedWorkspace.id}/projects`, { name: newProjectName }, axiosConfig);
      setNewProjectName('');
      selectWorkspace(selectedWorkspace);
    } catch (err) {
      alert('Không thể tạo Project');
    }
  };

  const handleCreateRoom = async () => {
    if (!newRoomName.trim() || !selectedProject) return;
    try {
      await axios.post(`http://localhost:8080/api/v1/projects/${selectedProject.id}/rooms`, { name: newRoomName }, axiosConfig);
      setNewRoomName('');
      selectProject(selectedProject);
    } catch (err) {
      alert('Không thể tạo Room');
    }
  };

  // Hàm mời thành viên
  const handleInviteMember = async () => {
    if (!inviteInput.trim() || !selectedWorkspace) return;
    try {
      await axios.post(
        `http://localhost:8080/api/v1/workspaces/${selectedWorkspace.id}/members`,
        { usernameOrEmail: inviteInput },
        axiosConfig
      );
      setInviteMsg(`✅ Đã thêm ${inviteInput} vào Workspace thành công!`);
      setInviteInput('');
    } catch (err: any) {
      setInviteMsg(`❌ ${err.response?.data?.message || 'Không thể thêm thành viên'}`);
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif' }}>
      {/* Sidebar Trai */}
      <div style={{ width: '260px', background: '#1e1e2d', color: '#fff', padding: '1rem', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0 }}>Visual Workspace</h3>
          <button onClick={logout} style={{ background: '#f5222d', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer' }}>Thoát</button>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <input
            type="text"
            placeholder="Tên Workspace..."
            value={newWorkspaceName}
            onChange={(e) => setNewWorkspaceName(e.target.value)}
            style={{ width: '100%', padding: '8px', boxSizing: 'border-box', marginBottom: '6px', borderRadius: '4px', border: '1px solid #444' }}
          />
          <button onClick={handleCreateWorkspace} style={{ width: '100%', padding: '8px', background: '#3699ff', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            + Workspace
          </button>
        </div>

        <h4>DANH SÁCH WORKSPACE</h4>
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {workspaces.map((ws) => (
            <div
              key={ws.id}
              onClick={() => selectWorkspace(ws)}
              style={{
                padding: '10px',
                marginBottom: '6px',
                borderRadius: '6px',
                background: selectedWorkspace?.id === ws.id ? '#3699ff' : '#2b2b40',
                cursor: 'pointer',
              }}
            >
              📁 {ws.name} <small style={{ opacity: 0.7 }}>({ws.currentUserRole})</small>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content Phai */}
      <div style={{ flex: 1, padding: '2rem', background: '#f5f7fa', overflowY: 'auto' }}>
        {selectedWorkspace ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <h2>Workspace: {selectedWorkspace.name}</h2>
              
              {/* Box Mời Thành Viên */}
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', background: '#fff', padding: '8px 12px', borderRadius: '6px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                <input
                  type="text"
                  placeholder="Nhập Username/Email TV..."
                  value={inviteInput}
                  onChange={(e) => setInviteInput(e.target.value)}
                  style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: '4px' }}
                />
                <button onClick={handleInviteMember} style={{ padding: '6px 12px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                  + Mời Thành Viên
                </button>
              </div>
            </div>

            {inviteMsg && <p style={{ color: inviteMsg.startsWith('✅') ? 'green' : 'red', fontWeight: 'bold' }}>{inviteMsg}</p>}

            {/* Danh sach Projects */}
            <h3>Dự án (Projects)</h3>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '1.5rem' }}>
              <input
                type="text"
                placeholder="Tên Project mới..."
                value={newProjectName}
                onChange={(e) => setNewProjectName(e.target.value)}
                style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px', width: '250px' }}
              />
              <button onClick={handleCreateProject} style={{ padding: '8px 16px', background: '#10b981', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                + Tạo Project
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
              {projects.map((pj) => (
                <div
                  key={pj.id}
                  onClick={() => selectProject(pj)}
                  style={{
                    padding: '1rem',
                    background: selectedProject?.id === pj.id ? '#e0e7ff' : '#fff',
                    border: selectedProject?.id === pj.id ? '2px solid #6366f1' : '1px solid #e2e8f0',
                    borderRadius: '8px',
                    cursor: 'pointer',
                  }}
                >
                  📁 <strong>{pj.name}</strong>
                  <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0 0' }}>Click để xem Rooms</p>
                </div>
              ))}
            </div>

            {/* Danh sach Rooms */}
            {selectedProject && (
              <div>
                <h3>Phòng làm việc (Rooms) trong {selectedProject.name}</h3>
                <div style={{ display: 'flex', gap: '10px', marginBottom: '1.5rem' }}>
                  <input
                    type="text"
                    placeholder="Tên Room mới..."
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    style={{ padding: '8px', border: '1px solid #ccc', borderRadius: '4px', width: '250px' }}
                  />
                  <button onClick={handleCreateRoom} style={{ padding: '8px 16px', background: '#8b5cf6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    + Tạo Room
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
                  {rooms.map((r) => (
                    <div key={r.id} style={{ padding: '1rem', background: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
                      🎨 <strong>{r.name}</strong>
                      <button
                        onClick={() => navigate(`/room/${r.id}`)}
                        style={{ marginTop: '0.75rem', width: '100%', padding: '8px', background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                      >
                        Vào Phòng Làm Việc
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p style={{ color: '#64748b' }}>Vui lòng chọn hoặc tạo mới 1 Workspace bên thanh trái.</p>
        )}
      </div>
    </div>
  );
};