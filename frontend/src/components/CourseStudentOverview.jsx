import React, { useEffect, useState } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Cell, PieChart, Pie, Legend
} from 'recharts';

const API_BASE_URL = "http://localhost:5000";
const COLORS = ['#6366f1', '#f97316', '#22c55e', '#ef4444', '#eab308'];

function CourseStudentOverview({ courseId }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!courseId) return;
        setLoading(true);
        fetch(`${API_BASE_URL}/analytics/learning-styles/${courseId}`)
            .then(res => res.json())
            .then(data => {
                if (data.error) throw new Error(data.error);
                setData(data);
            })
            .catch(err => setError(err.message))
            .finally(() => setLoading(false));
    }, [courseId]);

    if (loading) return <div style={{ padding: "20px", textAlign: "center" }}>Loading course overview...</div>;
    if (error) return <div style={{ padding: "20px", color: "red" }}>Error: {error}</div>;
    if (!data || !data.distribution || data.distribution.length === 0) return null;

    return (
        <div style={{
            backgroundColor: '#fff',
            borderRadius: '16px',
            padding: '24px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.05)',
            marginBottom: '32px',
            border: '1px solid #f0f0f0'
        }}>
            <h3 style={{ marginBottom: '20px', fontSize: '1.25rem', color: '#111' }}>📈 Course Student Insights</h3>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px' }}>

                {/* 1. Global Stats Card */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderRight: '1px solid #eee', paddingRight: '24px' }}>
                    <div style={{ display: 'flex', gap: '16px' }}>
                        <div style={{ flex: 1, backgroundColor: '#f0f9ff', padding: '16px', borderRadius: '12px' }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#0ea5e9' }}>{data.totalEnrolled}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Enrolled Users</div>
                        </div>
                        <div style={{ flex: 1, backgroundColor: '#f0fdf4', padding: '16px', borderRadius: '12px' }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#22c55e' }}>{data.totalAssessed}</div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase' }}>Assessed Styles</div>
                        </div>
                    </div>
                </div>

                {/* 2. Learning Style Pie Chart */}
                <div style={{ flex: 1 }}>
                    <h4 style={{ fontSize: '0.9rem', marginBottom: '10px', color: '#4b5563', textAlign: 'center' }}>Distribution of Learning Styles</h4>
                    <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                            <Pie
                                data={data.distribution}
                                cx="50%"
                                cy="50%"
                                innerRadius={60}
                                outerRadius={85}
                                paddingAngle={5}
                                dataKey="value"
                            >
                                {data.distribution.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip />
                            <Legend />
                        </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}

export default CourseStudentOverview;
