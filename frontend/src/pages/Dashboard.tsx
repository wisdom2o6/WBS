import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

interface Room {
  id: string;
  name: string;
}

interface Project {
  id: string;
  name: string;
  rooms: Room[];
}

interface Workspace {
  id: string;
  name: string;
  description: string;
  projects: Project[];
}

export const Dashboard: React.FC = () => {
  const { token, user, logout } = useAuth();
  const navigate = useNavigate();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWs, setSelectedWs] = useState<Workspace | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // Custom Headers Cho Axios
  const authHeaders = { headers: { Authorization: `Bearer ${token}` } };

  const fetchWorkspaces = async () => {
    try {
      const res = await axios.get('http://localhost:8080/api/v1/workspaces', authHeaders);
      setWorkspaces(res.data);
      if (res.data.length > 0 && !selectedWs) {
        setSelectedWs(res.data[0]);
      }
    } catch (err) {
      console.error('Lỗi tải danh sách Workspace:', err);
    }
  };

  useEffect(() => {
    if (token) fetchWorkspaces();
  }, [token]);

  // --- CRUD WORKSPACE ---
  const handleCreateWorkspace = async () => {
    const name = prompt('Nhập tên Workspace mới:');
    if (!name) return;
    const description = prompt('Nhập mô tả Workspace (tùy chọn):') || '';
    try {
      await axios.post('http://localhost:8080/api/v1/workspaces', { name, description }, authHeaders);
      fetchWorkspaces();
    } catch (err) { alert('Lỗi khi tạo Workspace'); }
  };

  const handleUpdateWorkspace = async (ws: Workspace) => {
    const newName = prompt('Nhập tên mới cho Workspace:', ws.name);
    if (!newName) return;
    const newDesc = prompt('Nhập mô tả mới:', ws.description || '') ?? '';
    try {
      await axios.put(`http://localhost:8080/api/v1/workspaces/${ws.id}`, { name: newName, description: newDesc }, authHeaders);
      fetchWorkspaces();
    } catch (err) { alert('Lỗi khi cập nhật Workspace'); }
  };

  const handleDeleteWorkspace = async (wsId: string) => {
    if (!window.confirm('Bạn có chắc muốn xóa Workspace này cùng tất cả Project & Room bên trong?')) return;
    try {
      await axios.delete(`http://localhost:8080/api/v1/workspaces/${wsId}`, authHeaders);
      if (selectedWs?.id === wsId) setSelectedWs(null);
      fetchWorkspaces();
    } catch (err) { alert('Lỗi khi xóa Workspace'); }
  };

  // --- CRUD PROJECT ---
  const handleCreateProject = async () => {
    if (!selectedWs) return alert('Vui lòng chọn Workspace trước!');
    const name = prompt('Nhập tên Project mới:');
    if (!name) return;
    try {
      await axios.post('http://localhost:8080/api/v1/projects', { name, workspaceId: selectedWs.id }, authHeaders);
      fetchWorkspaces();
    } catch (err) { alert('Lỗi khi tạo Project'); }
  };

  const handleUpdateProject = async (proj: Project) => {
    const newName = prompt('Nhập tên mới cho Project:', proj.name);
    if (!newName) return;
    try {
      await axios.put(`http://localhost:8080/api/v1/projects/${proj.id}`, { name: newName }, authHeaders);
      fetchWorkspaces();
    } catch (err) { alert('Lỗi khi cập nhật Project'); }
  };

  const handleDeleteProject = async (projId: string) => {
    if (!window.confirm('Bạn có chắc muốn xóa Project này?')) return;
    try {
      await axios.delete(`http://localhost:8080/api/v1/projects/${projId}`, authHeaders);
      if (selectedProject?.id === projId) setSelectedProject(null);
      fetchWorkspaces();
    } catch (err) { alert('Lỗi khi xóa Project'); }
  };

  // --- CRUD ROOM ---
  const handleCreateRoom = async (projId: string) => {
    const name = prompt('Nhập tên Phòng Canvas mới:');
    if (!name) return;
    try {
      await axios.post('http://localhost:8080/api/v1/rooms', { name, projectId: projId }, authHeaders);
      fetchWorkspaces();
    } catch (err) { alert('Lỗi khi tạo Phòng'); }
  };

  const handleUpdateRoom = async (room: Room) => {
    const newName = prompt('Nhập tên mới cho Room:', room.name);
    if (!newName) return;
    try {
      await axios.put(`http://localhost:8080/api/v1/rooms/${room.id}`, { name: newName }, authHeaders);
      fetchWorkspaces();
    } catch (err) { alert('Lỗi khi cập nhật Room'); }
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (!window.confirm('Bạn có chắc muốn xóa Phòng bảng vẽ này?')) return;
    try {
      await axios.delete(`http://localhost:8080/api/v1/rooms/${roomId}`, authHeaders);
      fetchWorkspaces();
    } catch (err) { alert('Lỗi khi xóa Room'); }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif', background: '#f8fafc' }}>
      {/* Sidebar: Workspaces */}
      <div style={{ width: '280px', background: '#0f172a', color: '#fff', padding: '1.2rem', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h3 style={{ margin: 0, fontSize: '18px', color: '#38bdf8' }}>🎨 Visual Space</h3>
          <button onClick={logout} style={{ background: '#ef4444', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>Đăng xuất</button>
        </div>

        <div style={{ fontSize: '12px', color: '#94a3b8', marginBottom: '1rem' }}>Tài khoản: <b>{user?.username}</b></div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem' }}>
          <span style={{ fontWeight: 'bold', fontSize: '13px', color: '#cbd5e1' }}>WORKSPACES</span>
          <button onClick={handleCreateWorkspace} style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '4px 8px', borderRadius: '4px', cursor: 'pointer', fontSize: '12px' }}>+ Tạo mới</button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {workspaces.map((ws) => (
            <div
              key={ws.id}
              onClick={() => { setSelectedWs(ws); setSelectedProject(null); }}
              style={{
                padding: '10px 12px',
                borderRadius: '8px',
                background: selectedWs?.id === ws.id ? '#1e293b' : 'transparent',
                borderLeft: selectedWs?.id === ws.id ? '4px solid #38bdf8' : '4px solid transparent',
                cursor: 'pointer',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}
            >
              <div>
                <div style={{ fontWeight: 'bold', fontSize: '14px', color: selectedWs?.id === ws.id ? '#fff' : '#cbd5e1' }}>{ws.name}</div>
                <div style={{ fontSize: '11px', color: '#64748b' }}>{ws.description || 'Không có mô tả'}</div>
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button onClick={(e) => { e.stopPropagation(); handleUpdateWorkspace(ws); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '12px' }}>✏️</button>
                <button onClick={(e) => { e.stopPropagation(); handleDeleteWorkspace(ws.id); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '12px' }}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Panel: Projects & Rooms */}
      <div style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        {selectedWs ? (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ margin: 0, color: '#0f172a' }}>{selectedWs.name}</h2>
                <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '14px' }}>{selectedWs.description}</p>
              </div>
              <button onClick={handleCreateProject} style={{ background: '#2563eb', color: '#fff', border: 'none', padding: '8px 16px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                + Tạo Project Mới
              </button>
            </div>

            {/* Projects List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {selectedWs.projects?.map((proj) => (
                <div key={proj.id} style={{ background: '#fff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '1.2rem', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                    <h3 style={{ margin: 0, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      📁 {proj.name}
                      <button onClick={() => handleUpdateProject(proj)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '14px' }}>✏️</button>
                      <button onClick={() => handleDeleteProject(proj.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '14px' }}>🗑️</button>
                    </h3>
                    <button onClick={() => handleCreateRoom(proj.id)} style={{ background: '#f1f5f9', color: '#2563eb', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 600, fontSize: '13px' }}>
                      + Thêm Phòng Canvas
                    </button>
                  </div>

                  {/* Rooms Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '1rem' }}>
                    {proj.rooms?.map((room) => (
                      <div
                        key={room.id}
                        style={{
                          background: '#f8fafc',
                          border: '1px solid #cbd5e1',
                          borderRadius: '8px',
                          padding: '1rem',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          height: '100px',
                          position: 'relative'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                          <div style={{ fontWeight: 'bold', color: '#334155', fontSize: '15px' }}>🖼️ {room.name}</div>
                          <div style={{ display: 'flex', gap: '2px' }}>
                            <button onClick={() => handleUpdateRoom(room)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '12px' }}>✏️</button>
                            <button onClick={() => handleDeleteRoom(room.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '12px' }}>🗑️</button>
                          </div>
                        </div>

                        <button
                          onClick={() => navigate(`/room/${room.id}`)}
                          style={{
                            background: '#2563eb',
                            color: '#fff',
                            border: 'none',
                            padding: '6px 12px',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            fontSize: '12px',
                            width: '100%'
                          }}
                        >
                          Vào Bảng Vẽ →
                        </button>
                      </div>
                    ))}
                    {(!proj.rooms || proj.rooms.length === 0) && (
                      <div style={{ color: '#94a3b8', fontSize: '13px', fontStyle: 'italic', gridColumn: '1/-1' }}>Chưa có phòng vẽ nào trong Project này.</div>
                    )}
                  </div>
                </div>
              ))}
              {(!selectedWs.projects || selectedWs.projects.length === 0) && (
                <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>Workspace này chưa có Project nào. Hãy bấm nút "+ Tạo Project Mới" ở trên!</div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#94a3b8' }}>Chọn một Workspace bên trái để bắt đầu quản lý.</div>
        )}
      </div>
    </div>
  );
};