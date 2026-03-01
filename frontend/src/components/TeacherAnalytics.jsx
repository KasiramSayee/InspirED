import React, { useEffect, useState } from 'react';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Cell
} from 'recharts';

const API_BASE_URL = "http://localhost:5000";

const getScoreColor = (score, maxScore) => {
    if (maxScore === 0) return '#6366f1';
    const ratio = score / maxScore;
    if (ratio < 0.4) return '#ef4444';
    if (ratio < 0.7) return '#f97316';
    if (ratio < 0.9) return '#eab308';
    return '#22c55e';
};

function TeacherAnalytics({ courseId, lectureIndex, lectureTitle }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (courseId === undefined || lectureIndex === undefined) return;
        setLoading(true);
        setError(null);

        fetch(`${API_BASE_URL}/ai/analytics/lecture?courseId=${courseId}&lectureIndex=${lectureIndex}`)
            .then(r => r.json())
            .then(lectureData => {
                if (lectureData.error) throw new Error(lectureData.error);
                setData(lectureData);
            })
            .catch(e => setError(e.message))
            .finally(() => setLoading(false));
    }, [courseId, lectureIndex]);

    const containerStyle = {
        backgroundColor: '#fff',
        borderRadius: '16px',
        padding: '30px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.07)',
        marginTop: '24px',
    };

    if (loading) return (
        <div style={containerStyle}>
            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                <div style={{ fontSize: '2rem', marginBottom: '10px' }}>📊</div>
                Loading analytics for <strong>{lectureTitle}</strong>…
            </div>
        </div>
    );

    if (error) return (
        <div style={containerStyle}>
            <div style={{ textAlign: 'center', padding: '30px', color: '#ef4444' }}>
                ⚠️ Failed to load analytics: {error}
            </div>
        </div>
    );

    const { scoreDistribution = [], weakTopics = [], methodPerformance = [], studentCount = 0 } = data;
    const hasScores = scoreDistribution.some(d => d.students > 0);
    const hasTopics = weakTopics.length > 0;
    const hasPerformance = methodPerformance.length > 0;
    const maxScore = scoreDistribution.length > 0 ? scoreDistribution[scoreDistribution.length - 1].score : 0;

    const ScoreTooltip = ({ active, payload }) => {
        if (active && payload?.length) {
            return (
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px 14px', fontSize: '0.85rem' }}>
                    <div><strong>Score: {payload[0].payload.score}/{maxScore}</strong></div>
                    <div style={{ color: '#6366f1' }}>{payload[0].value} student{payload[0].value !== 1 ? 's' : ''}</div>
                </div>
            );
        }
        return null;
    };

    const TopicTooltip = ({ active, payload }) => {
        if (active && payload?.length) {
            return (
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px 14px', fontSize: '0.85rem' }}>
                    <div><strong>{payload[0].payload.topic}</strong></div>
                    <div style={{ color: '#ef4444' }}>{payload[0].value} student{payload[0].value !== 1 ? 's' : ''} struggling</div>
                </div>
            );
        }
        return null;
    };

    const PerformanceTooltip = ({ active, payload }) => {
        if (active && payload?.length) {
            return (
                <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '10px 14px', fontSize: '0.85rem' }}>
                    <div><strong>{payload[0].payload.name}</strong></div>
                    <div style={{ color: '#6366f1' }}>Avg Score: {payload[0].value}%</div>
                </div>
            );
        }
        return null;
    };

    return (
        <div style={containerStyle}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                    <h3 style={{ margin: 0, fontSize: '1.25rem' }}>📊 Lecture Analytics — {lectureTitle}</h3>
                    <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: '0.85rem' }}>
                        Performance on this specific lecture's quiz
                    </p>
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                    <div style={{ textAlign: 'center', padding: '10px 18px', backgroundColor: '#f0f9ff', borderRadius: '10px' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#0ea5e9' }}>{studentCount}</div>
                        <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Attempted</div>
                    </div>
                </div>
            </div>

            {!hasScores && !hasTopics ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#9ca3af', fontStyle: 'italic' }}>
                    No quiz data yet for this lecture. Students need to attempt the quiz first.
                </div>
            ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '40px' }}>

                    <div style={{ display: 'grid', gridTemplateColumns: hasTopics ? '1fr 1fr' : '1fr', gap: '32px', alignItems: 'start' }}>
                        {/* ── Chart 1: Score Distribution ── */}
                        {hasScores && (
                            <div>
                                <h4 style={{ margin: '0 0 4px', color: '#374151', fontSize: '1rem' }}>🎯 Score Distribution</h4>
                                <p style={{ margin: '0 0 14px', fontSize: '0.8rem', color: '#9ca3af' }}>X-axis: Score &nbsp;|&nbsp; Y-axis: Students</p>
                                <ResponsiveContainer width="100%" height={260}>
                                    <BarChart data={scoreDistribution} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                                        <XAxis dataKey="score" tick={{ fontSize: 13 }} />
                                        <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                                        <Tooltip content={<ScoreTooltip />} />
                                        <Bar dataKey="students" radius={[6, 6, 0, 0]}>
                                            {scoreDistribution.map((entry, i) => (
                                                <Cell key={`sc-${i}`} fill={getScoreColor(entry.score, maxScore)} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}

                        {/* ── Chart 2: Weak Topics ── */}
                        {hasTopics && (
                            <div>
                                <h4 style={{ margin: '0 0 4px', color: '#374151', fontSize: '1rem' }}>⚠️ Struggle Topics</h4>
                                <p style={{ margin: '0 0 14px', fontSize: '0.8rem', color: '#9ca3af' }}>Grouping related mistakes</p>
                                <ResponsiveContainer width="100%" height={Math.max(260, weakTopics.length * 40)}>
                                    <BarChart layout="vertical" data={weakTopics} margin={{ top: 5, right: 30, left: 8, bottom: 20 }}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" horizontal={false} />
                                        <XAxis type="number" allowDecimals={false} tick={{ fontSize: 12 }} />
                                        <YAxis type="category" dataKey="topic" width={140} tick={{ fontSize: 11 }} />
                                        <Tooltip content={<TopicTooltip />} />
                                        <Bar dataKey="count" fill="#ef4444" radius={[0, 6, 6, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        )}
                    </div>

                    {/* ── Chart 3: Performance by Method ── */}
                    <div style={{ border: "1px solid #f3f4f6", borderRadius: "12px", padding: "24px", backgroundColor: "#fafafa", marginTop: "20px" }}>
                        <p style={{ color: "red", fontSize: "0.8rem" }}>DEBUG: methodPerformance count: {methodPerformance?.length || 0}</p>
                        <h4 style={{ margin: '0 0 4px', color: '#1f2937', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            🧠 Avg. Performance per Learning Method
                        </h4>
                        <p style={{ margin: '0 0 24px', fontSize: '0.8rem', color: '#6b7280' }}>
                            Comparing how students in different groups scored on this quiz (Average %)
                        </p>
                        <div style={{ height: '300px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={methodPerformance} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                                    <XAxis dataKey="name" tick={{ fontSize: 13, fill: '#4b5563' }} />
                                    <YAxis domain={[0, 100]} tick={{ fontSize: 12, fill: '#4b5563' }} />
                                    <Tooltip content={<PerformanceTooltip />} />
                                    <Bar dataKey="value" barSize={60} radius={[8, 8, 0, 0]}>
                                        {methodPerformance.map((entry, i) => (
                                            <Cell key={`perf-${i}`} fill={i === 0 ? '#6366f1' : i === 1 ? '#f97316' : '#22c55e'} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default TeacherAnalytics;
