# D3.js Vertical Track

A reusable D3.js component for rendering vertical tracks commonly used in well log, geological, thermal, and depth-based visualizations.

## Features

* Vertical track rendering using D3.js
* High-performance SVG visualization
* Configurable scales and axes
* Support for depth-based datasets
* Dynamic resizing
* Customizable styling and colors
* Interactive tooltips and hover effects
* Suitable for geological and engineering applications

## Installation

```bash
npm install
```

## Usage

```javascript
import VerticalTrack from './VerticalTrack';

const data = [
    { x: 5130, y: 1.85 },
    { x: 5130.25, y: 1.86 },
    { x: 5130.5, y: 1.90 }
];

const track = new VerticalTrack({
    container: '#track',
    width: 200,
    height: 800,
    data: data
});

track.render();
```

## Data Format

```javascript
[
  {
    x: 5130,
    y: 1.85
  },
  {
    x: 5130.25,
    y: 1.86
  }
]
```

## Configuration

| Option   | Description               |
| -------- | ------------------------- |
| width    | Track width               |
| height   | Track height              |
| data     | Input dataset             |
| minDepth | Minimum depth             |
| maxDepth | Maximum depth             |
| colors   | Track color configuration |

## Example

The component can be used to visualize:

* Well logs
* Thermal gradients
* Geological formations
* Depth-based measurements
* Scientific vertical profiles

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Technologies

* D3.js
* JavaScript
* SVG

[Edit in StackBlitz next generation editor ⚡️](https://stackblitz.com/~/github.com/amirgeolog93-hub/d3JsVerticalTrack)
