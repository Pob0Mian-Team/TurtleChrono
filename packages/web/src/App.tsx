import { FocusWrapper } from './components/FocusWrapper';
import { Sidebar } from './components/Sidebar';
import { MapPanel } from './components/MapPanel';
import { GForcePanel } from './components/GForcePanel';
import { ChartPanel } from './components/ChartPanel';
import { PlaybackBar } from './components/PlaybackBar';
import { LapInfoPanel } from './components/LapInfoPanel';
import styles from './App.module.css';

export default function App() {
  return (
    <div className={styles.app}>
      <div className={styles.sidebar}>
        <Sidebar />
      </div>
      <FocusWrapper panelId="map" className={styles.mapPanel}>
        <MapPanel />
      </FocusWrapper>
      <div className={styles.middleSection}>
        <div className={styles.leftColumn}>
          <FocusWrapper panelId="gforce">
            <GForcePanel />
          </FocusWrapper>
          <LapInfoPanel />
        </div>
        <FocusWrapper panelId="chart" className={styles.chartPanel}>
          <ChartPanel />
        </FocusWrapper>
      </div>
      <div className={styles.playbackBar}>
        <PlaybackBar />
      </div>
    </div>
  );
}
