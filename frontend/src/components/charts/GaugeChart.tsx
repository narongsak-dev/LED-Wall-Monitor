import ReactECharts from 'echarts-for-react';
import { useTheme } from '@/features/theme/useTheme';

interface GaugeChartProps {
  value: number;
  min?: number;
  max: number;
  unit: string;
  color?: string;
  warningThreshold?: number;
}

export function GaugeChart({
  value,
  min = 0,
  max,
  unit,
  color = '#22d3ee',
  warningThreshold,
}: GaugeChartProps) {
  const themeMode = useTheme();
  const isWarning = warningThreshold !== undefined && value >= warningThreshold;
  const displayColor = isWarning ? '#facc15' : color;
  const trackColor = themeMode === 'dark' ? '#1f2937' : '#e5e7eb';

  const option = {
    series: [
      {
        type: 'gauge',
        startAngle: 215,
        endAngle: -35,
        min,
        max,
        radius: '95%',
        axisLine: {
          lineStyle: {
            width: 12,
            color: [
              [Math.min(1, Math.max(0, (value - min) / (max - min))), displayColor],
              [1, trackColor],
            ],
          },
        },
        progress: { show: false },
        axisTick: { show: false },
        splitLine: { show: false },
        axisLabel: { show: false },
        pointer: { show: false },
        anchor: { show: false },
        title: { show: false },
        detail: {
          valueAnimation: true,
          fontSize: 26,
          fontWeight: 'bold',
          color: displayColor,
          offsetCenter: [0, '0%'],
          formatter: (v: number) => v.toFixed(value < 10 ? 2 : 1),
        },
        data: [{ value }],
      },
    ],
  };

  return (
    <div style={{ position: 'relative' }}>
      <ReactECharts option={option} style={{ height: 150 }} />
      <div
        style={{
          position: 'absolute',
          bottom: 8,
          left: 0,
          right: 0,
          textAlign: 'center',
          fontSize: 12,
          color: 'var(--dim)',
        }}
      >
        {unit}
      </div>
    </div>
  );
}
