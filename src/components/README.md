# Component Documentation

## PolarComparison3D

This component provides a 3D visualization for comparing polar response data between multiple acoustic products. It combines the grid layout approach from `MeshComparison` with the 3D visualization capabilities of `PolarResponse3D`.

### Features

- Grid layout for comparing multiple products at once
- 3D visualization of polar response data with interactive camera controls
- Synchronized camera movement between grid cells
- Source angle selection with 3D visualization
- Toggle between diffusor and reflector data
- Frequency slider for exploring different frequency bands
- Adjustable pressure limit to control visualization scale

### Usage

```jsx
import PolarComparison3D from './components/PolarComparison3D';

// In your component:
<PolarComparison3D fileIds={selectedFileIds} />
```

### Dependencies

- react-three-fiber and drei for 3D rendering
- THREE.js for 3D graphics
- SourceAngleVisualizer for source selection

### API

| Prop | Type | Description |
|------|------|-------------|
| `fileIds` | string[] | Array of file IDs to compare |

### Server Endpoints

The component relies on these server endpoints:

- `/compare/polar3d?file_ids={ids}&source_index={idx}&freq_index={idx}&surface={type}` - Get 3D polar response data for multiple files
- `/receiver_data/{file_id}` - Get the receiver mesh data (coordinates and connectivity)

### Related Components

- `PolarResponse3D` - Single-file 3D polar response visualization
- `PolarComparison` - 2D polar response comparison visualization
- `MeshComparison` - Product geometry comparison in 3D grid layout
- `SourceAngleVisualizer` - 3D visualization for source angle selection 