import { useSessionStore, type ChartType } from '../store/session-store';
import { SpeedChart } from './SpeedChart';
import { DeltaChart } from './DeltaChart';
import styles from './ChartContainer.module.css';

const CHART_REGISTRY: Record<ChartType, { label: string; component: React.ComponentType }> = {
  speed: { label: 'Speed', component: SpeedChart },
  delta: { label: 'Delta', component: DeltaChart },
};

export function ChartContainer() {
  const enabledCharts = useSessionStore((s) => s.enabledCharts);

  return (
    <div className={styles.container}>
      {enabledCharts.map((type) => {
        const entry = CHART_REGISTRY[type];
        const ChartComponent = entry.component;
        return (
          <div key={type} className={styles.chartSlot}>
            <ChartComponent />
          </div>
        );
      })}
    </div>
  );
}
