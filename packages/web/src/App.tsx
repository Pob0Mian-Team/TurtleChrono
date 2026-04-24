import { FocusWrapper } from './components/FocusWrapper';
import { Sidebar } from './components/Sidebar';
import { MapPanel } from './components/MapPanel';
import { GForcePanel } from './components/GForcePanel';
import { ChartContainer } from './components/ChartContainer';
import { PlaybackBar } from './components/PlaybackBar';
import { LapInfoPanel } from './components/LapInfoPanel';
import styles from './App.module.css';

export default function App() {
  return (
    <div className={styles.app}>
      <div className={styles.sidebar}>
        <Sidebar />
      </div>
      <div className={styles.leftColumn}>
        <FocusWrapper panelId="map" className={styles.mapPanel}>
          <MapPanel />
        </FocusWrapper>
        <FocusWrapper panelId="gforce" className={styles.gforcePanel}>
          <GForcePanel />
        </FocusWrapper>
        <div className={styles.lapInfoPanel}>
          <LapInfoPanel />
        </div>
      </div>
      <div className={styles.chartColumn}>
        <ChartContainer />
      </div>
      <div className={styles.playbackBar}>
        <PlaybackBar />
      </div>
    </div>
  );
}
