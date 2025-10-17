import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Droplet, Activity, Zap, Leaf, AlertTriangle, CheckCircle, TrendingUp, Play, Square } from 'lucide-react';
import './App.css';

const SoilMonitorDashboard = () => {
  // State management
  const [sensorData, setSensorData] = useState([]);
  const [currentValues, setCurrentValues] = useState({
    moisture: 45,
    ph: 6.8,
    ec: 1.2,
    nitrogen: 35,
    potassium: 25,
    phosphorus: 18
  });
  const [alerts, setAlerts] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [cumsum, setCumsum] = useState({ positive: 0, negative: 0 });
  const [systemStats, setSystemStats] = useState({
    totalReadings: 0,
    anomaliesDetected: 0,
    dataAccuracy: 0
  });

  // Kalman Filter state
  const [kalmanState, setKalmanState] = useState({
    estimate: 45,
    errorCovariance: 1,
    processNoise: 0.01,
    measurementNoise: 0.5,
    innovation: 0
  });

  /**
   * Generate simulated sensor reading with noise
   */
  const generateSensorReading = (baseValue, variance, anomaly = false) => {
    const noise = (Math.random() - 0.5) * variance;
    const anomalyOffset = anomaly ? (Math.random() > 0.5 ? 20 : -20) : 0;
    return Math.max(0, baseValue + noise + anomalyOffset);
  };

  /**
   * Adaptive Kalman Filter Implementation
   */
  const kalmanFilter = (measurement, state) => {
    // Prediction Step
    const predictedEstimate = state.estimate;
    const predictedErrorCov = state.errorCovariance + state.processNoise;

    // Innovation calculation
    const innovation = measurement - predictedEstimate;
    const innovationCov = predictedErrorCov + state.measurementNoise;

    // Adaptive Process Noise Adjustment
    const lambda = (innovation * innovation) / innovationCov;
    const chiSquareThreshold = 3.84;
    
    const adaptiveProcessNoise = lambda > chiSquareThreshold 
      ? state.processNoise * 2.5
      : 0.01;

    // Kalman Gain
    const kalmanGain = predictedErrorCov / innovationCov;

    // Update Step
    const newEstimate = predictedEstimate + kalmanGain * innovation;
    const newErrorCov = (1 - kalmanGain) * predictedErrorCov;

    return {
      estimate: newEstimate,
      errorCovariance: newErrorCov,
      processNoise: adaptiveProcessNoise,
      measurementNoise: state.measurementNoise,
      innovation: innovation
    };
  };

  /**
   * CUSUM Anomaly Detection Algorithm
   */
  const detectAnomaly = (innovation, currentCumsum) => {
    const delta = 0.5;
    const threshold = 5;

    const sPlus = Math.max(0, currentCumsum.positive + innovation - delta);
    const sMinus = Math.min(0, currentCumsum.negative + innovation + delta);

    const isAnomaly = sPlus > threshold || sMinus < -threshold;

    return {
      cumsum: { positive: sPlus, negative: sMinus },
      isAnomaly: isAnomaly,
      type: sPlus > threshold ? 'high' : (sMinus < -threshold ? 'low' : 'normal')
    };
  };

  /**
   * Get parameter status based on optimal ranges
   */
  const getParameterStatus = (value, parameter) => {
    const ranges = {
      moisture: { optimal: [40, 50], warning: [35, 55] },
      ph: { optimal: [6.5, 7.0], warning: [6.0, 7.5] },
      ec: { optimal: [1.0, 1.5], warning: [0.8, 1.8] },
      nitrogen: { optimal: [30, 40], warning: [25, 45] },
      phosphorus: { optimal: [15, 25], warning: [10, 30] },
      potassium: { optimal: [20, 30], warning: [15, 35] }
    };

    const range = ranges[parameter];
    if (!range) return 'unknown';

    if (value >= range.optimal[0] && value <= range.optimal[1]) return 'optimal';
    if (value >= range.warning[0] && value <= range.warning[1]) return 'warning';
    return 'critical';
  };

  /**
   * Main monitoring loop
   */
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      const timestamp = new Date().toLocaleTimeString();
      const hasAnomaly = Math.random() < 0.04; // 4% chance for anomaly
      
      // Generate all sensor readings
      const rawMoisture = generateSensorReading(45, 5, hasAnomaly);
      const newKalmanState = kalmanFilter(rawMoisture, kalmanState);
      setKalmanState(newKalmanState);
      
      const anomalyResult = detectAnomaly(newKalmanState.innovation, cumsum);
      setCumsum(anomalyResult.cumsum);

      // Update all sensor values
      const newValues = {
        moisture: Math.round(newKalmanState.estimate * 10) / 10,
        ph: Math.round((6.8 + (Math.random() - 0.5) * 0.4) * 10) / 10,
        ec: Math.round((1.2 + (Math.random() - 0.5) * 0.2) * 10) / 10,
        nitrogen: Math.round(35 + (Math.random() - 0.5) * 8),
        phosphorus: Math.round(18 + (Math.random() - 0.5) * 6),
        potassium: Math.round(25 + (Math.random() - 0.5) * 6)
      };
      
      setCurrentValues(newValues);

      // Store historical data
      setSensorData(prev => {
        const newData = [...prev, {
          time: timestamp,
          raw: Math.round(rawMoisture * 10) / 10,
          filtered: newValues.moisture,
          ph: newValues.ph,
          ec: newValues.ec,
          nitrogen: newValues.nitrogen
        }];
        return newData.slice(-25);
      });

      // Generate alert if anomaly detected
      if (anomalyResult.isAnomaly) {
        const alertMsg = {
          id: Date.now(),
          type: anomalyResult.type === 'high' ? 'warning' : 'critical',
          message: anomalyResult.type === 'high' 
            ? 'High moisture detected - Check irrigation system'
            : 'Low moisture detected - Consider irrigation',
          timestamp: timestamp,
          parameter: 'Soil Moisture',
          value: newValues.moisture
        };
        
        setAlerts(prev => [alertMsg, ...prev].slice(0, 8));
        setSystemStats(prev => ({
          ...prev,
          anomaliesDetected: prev.anomaliesDetected + 1
        }));
      }

      // Update system statistics
      setSystemStats(prev => ({
        ...prev,
        totalReadings: prev.totalReadings + 1,
        dataAccuracy: Math.min(100, prev.dataAccuracy + 0.1)
      }));

    }, 2000);

    return () => clearInterval(interval);
  }, [isRunning, kalmanState, cumsum]);

  /**
   * Clear all alerts
   */
  const clearAlerts = () => {
    setAlerts([]);
  };

  /**
   * Reset system
   */
  const resetSystem = () => {
    setSensorData([]);
    setAlerts([]);
    setCumsum({ positive: 0, negative: 0 });
    setSystemStats({
      totalReadings: 0,
      anomaliesDetected: 0,
      dataAccuracy: 0
    });
  };

  return (
    <div className="soil-monitor-dashboard">
      {/* Header Section */}
      <div className="dashboard-header">
        <div className="header-content">
          <div className="header-text">
            <h1 className="dashboard-title">Precision Agriculture Dashboard</h1>
            <p className="dashboard-subtitle">
              Real-time Soil Health Monitoring with Adaptive Kalman-CUSUM Algorithm
            </p>
          </div>
          <div className="header-controls">
            <button
              onClick={() => setIsRunning(!isRunning)}
              className={`control-button ${isRunning ? 'stop-button' : 'start-button'}`}
            >
              {isRunning ? <Square size={16} /> : <Play size={16} />}
              {isRunning ? 'Stop Monitoring' : 'Start Monitoring'}
            </button>
            <button onClick={clearAlerts} className="control-button secondary-button">
              Clear Alerts
            </button>
            <button onClick={resetSystem} className="control-button secondary-button">
              Reset System
            </button>
          </div>
        </div>
      </div>

      {/* System Overview Cards */}
      <div className="system-overview">
        <div className="stat-card overview-card">
          <div className="stat-icon total-readings">
            <TrendingUp size={24} />
          </div>
          <div className="stat-content">
            <h3>Total Readings</h3>
            <p className="stat-value">{systemStats.totalReadings}</p>
          </div>
        </div>
        
        <div className="stat-card overview-card">
          <div className="stat-icon anomalies">
            <AlertTriangle size={24} />
          </div>
          <div className="stat-content">
            <h3>Anomalies Detected</h3>
            <p className="stat-value">{systemStats.anomaliesDetected}</p>
          </div>
        </div>
        
        <div className="stat-card overview-card">
          <div className="stat-icon accuracy">
            <Activity size={24} />
          </div>
          <div className="stat-content">
            <h3>System Accuracy</h3>
            <p className="stat-value">{systemStats.dataAccuracy.toFixed(1)}%</p>
          </div>
        </div>
      </div>

      {/* Real-time Parameter Cards */}
      <div className="parameter-grid">
        {[
          { key: 'moisture', label: 'Soil Moisture', value: currentValues.moisture, unit: '%', icon: Droplet, optimal: '40-50%' },
          { key: 'ph', label: 'pH Level', value: currentValues.ph, unit: '', icon: Activity, optimal: '6.5-7.0' },
          { key: 'ec', label: 'EC', value: currentValues.ec, unit: 'dS/m', icon: Zap, optimal: '1.0-1.5' },
          { key: 'nitrogen', label: 'Nitrogen', value: currentValues.nitrogen, unit: 'ppm', icon: Leaf, optimal: '30-40' },
          { key: 'phosphorus', label: 'Phosphorus', value: currentValues.phosphorus, unit: 'ppm', icon: Leaf, optimal: '15-25' },
          { key: 'potassium', label: 'Potassium', value: currentValues.potassium, unit: 'ppm', icon: Leaf, optimal: '20-30' }
        ].map((param) => {
          const status = getParameterStatus(param.value, param.key);
          const IconComponent = param.icon;
          
          return (
            <div key={param.key} className={`parameter-card ${status}-card`}>
              <div className="parameter-header">
                <div className="parameter-info">
                  <h3 className="parameter-label">{param.label}</h3>
                  <p className="parameter-optimal">Optimal: {param.optimal}</p>
                </div>
                <div className={`parameter-icon ${status}`}>
                  <IconComponent size={32} />
                </div>
              </div>
              <p className="parameter-value">{param.value}{param.unit}</p>
              <div className="parameter-status">
                <span className={`status-indicator ${status}`}>
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Charts and Alerts Section */}
      <div className="content-grid">
        {/* Historical Trends Chart */}
        <div className="chart-container">
          <div className="chart-header">
            <TrendingUp size={20} />
            <h2>Historical Trends - Kalman Filtered vs Raw Data</h2>
          </div>
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={sensorData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis 
                dataKey="time" 
                tick={{ fontSize: 12, fill: '#666' }}
                stroke="#ccc"
              />
              <YAxis 
                tick={{ fontSize: 12, fill: '#666' }}
                stroke="#ccc"
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'white', 
                  border: '1px solid #e0e0e0',
                  borderRadius: '8px'
                }}
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="raw" 
                stroke="#94a3b8" 
                name="Raw Sensor Data" 
                strokeWidth={1.5}
                dot={false}
                strokeDasharray="3 3"
              />
              <Line 
                type="monotone" 
                dataKey="filtered" 
                stroke="#10b981" 
                name="Kalman Filtered" 
                strokeWidth={2.5}
                dot={false}
              />
              <Line 
                type="monotone" 
                dataKey="ph" 
                stroke="#8b5cf6" 
                name="pH Level" 
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Alerts Panel */}
        <div className="alerts-container">
          <div className="alerts-header">
            <AlertTriangle size={20} />
            <h2>Anomaly Detection Alerts</h2>
            <span className="alerts-count">{alerts.length}</span>
          </div>
          
          <div className="alerts-list">
            {alerts.length === 0 ? (
              <div className="no-alerts">
                <CheckCircle size={48} className="no-alerts-icon" />
                <p>No anomalies detected</p>
                <p className="no-alerts-subtitle">System operating within normal parameters</p>
              </div>
            ) : (
              alerts.map(alert => (
                <div key={alert.id} className={`alert-item ${alert.type}-alert`}>
                  <div className="alert-icon">
                    <AlertTriangle size={16} />
                  </div>
                  <div className="alert-content">
                    <p className="alert-message">{alert.message}</p>
                    <div className="alert-meta">
                      <span className="alert-parameter">{alert.parameter}</span>
                      <span className="alert-value">{alert.value}</span>
                      <span className="alert-time">{alert.timestamp}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Algorithm Status Panel */}
      <div className="algorithm-status">
        <h2 className="status-title">Algorithm Performance Metrics</h2>
        <div className="status-grid">
          <div className="metric-card">
            <h3>Kalman Filter</h3>
            <div className="metric-values">
              <div className="metric">
                <span className="metric-label">Current Estimate:</span>
                <span className="metric-value">{Math.round(kalmanState.estimate * 10) / 10}%</span>
              </div>
              <div className="metric">
                <span className="metric-label">Process Noise (Q):</span>
                <span className="metric-value">{kalmanState.processNoise.toFixed(4)}</span>
              </div>
              <div className="metric">
                <span className="metric-label">Innovation:</span>
                <span className="metric-value">{Math.round(kalmanState.innovation * 100) / 100}</span>
              </div>
            </div>
          </div>

          <div className="metric-card">
            <h3>CUSUM Algorithm</h3>
            <div className="metric-values">
              <div className="metric">
                <span className="metric-label">Positive CUSUM (S⁺):</span>
                <span className="metric-value">{Math.round(cumsum.positive * 100) / 100}</span>
              </div>
              <div className="metric">
                <span className="metric-label">Negative CUSUM (S⁻):</span>
                <span className="metric-value">{Math.round(cumsum.negative * 100) / 100}</span>
              </div>
              <div className="metric">
                <span className="metric-label">Detection Threshold:</span>
                <span className="metric-value">5.0</span>
              </div>
            </div>
          </div>

          <div className="metric-card">
            <h3>System Performance</h3>
            <div className="metric-values">
              <div className="metric">
                <span className="metric-label">Update Frequency:</span>
                <span className="metric-value">2 seconds</span>
              </div>
              <div className="metric">
                <span className="metric-label">Data Points:</span>
                <span className="metric-value">{sensorData.length}</span>
              </div>
              <div className="metric">
                <span className="metric-label">Active Sensors:</span>
                <span className="metric-value">6 parameters</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SoilMonitorDashboard;