export interface SampleDataset {
  id: string;
  name: string;
  industry: string;
  description: string;
  icon: string;
  filename: string;
  content: string;
}

export const SAMPLE_DATASETS: SampleDataset[] = [
  {
    id: "cnc_milling",
    name: "CNC Milling & Machining",
    industry: "Precision Engineering",
    description: "German SAP ERP format with 5-axis milling, drilling, tapping & grinding setup/run times.",
    icon: "CNC",
    filename: "test_cnc_milling_workshop.csv",
    content: `Order,Order Process ID,Material,Machine,Maschine-Group,Process Text,SOP Start Date,Order QTY,Base-Qty each process,Set up Time (Not related to any qty),Unit,Process time (related to qty),Unit,Summe V2/Sum total process time,Manpwer Utilization,Unit,Summe V3 SUM total Manpower utilization process,Manpower Utilization in %,SOP Start time
1023801,10,100-024-830.01-00,603011,M2,"FRÄSEN: Planfräsen H-90",01-06-2026,120,1,45,MIN,4.5,MIN,585,1.5,MIN,585,50%,08:00:00
1023801,20,100-024-830.01-00,603012,M1,"BOHREN: Du. 12.5H7 - 4x",01-06-2026,120,1,30,MIN,2.2,MIN,294,1.0,MIN,294,30%,10:30:00
1023802,10,100-011-114.01-00,605001,M1,"KOMPLETTBEARBEITUNG: Gehäuse",01-06-2026,250,5,90,MIN,12.0,MIN,690,2.0,MIN,1380,60%,07:30:00
1023802,20,100-011-114.01-00,603010,M2,"KONTROLLE: 100% Passmaß",01-06-2026,250,10,15,MIN,1.0,MIN,40,0.5,MIN,20,20%,12:00:00
1023803,10,100-008-517.01-00,603011,M2,"FRÄSEN: Nut 8 mit Fase 1x45",02-06-2026,180,1,60,MIN,5.0,MIN,960,2.5,MIN,480,50%,08:15:00
1023803,20,100-008-517.01-00,605001,M1,"ENTGRATEN & REINIGEN",02-06-2026,180,1,20,MIN,0.8,MIN,164,1.0,MIN,164,100%,14:00:00
1023804,10,100-007-598.01-00,603012,M1,"FRÄSEN: Kontur & Taschen",02-06-2026,320,10,120,MIN,18.5,MIN,712,3.0,MIN,2136,75%,09:00:00
1023804,20,100-007-598.01-00,603010,M2,"GEWINDE: 8x M6/6H tief",02-06-2026,320,1,45,MIN,1.5,MIN,525,1.0,MIN,525,40%,15:30:00
1023805,10,100-008-170.01-00,605001,M1,"SCHRUPPEN: Außenkontur",03-06-2026,500,4,150,MIN,14.0,MIN,1900,4.0,MIN,7600,32%,06:30:00
1023805,20,100-008-170.01-00,603011,M2,"SCHLICHTEN: Innenkontur",03-06-2026,500,4,60,MIN,8.5,MIN,1122.5,2.0,MIN,2245,50%,13:00:00
1023806,10,100-008-648.01-00,603010,M2,"BOHREN: Kernlöcher M10",03-06-2026,90,1,30,MIN,3.2,MIN,318,1.0,MIN,318,100%,08:00:00
1023806,20,100-008-648.01-00,603012,M1,"PLANFRÄSEN: Deckelfläche",03-06-2026,90,1,40,MIN,2.0,MIN,220,1.0,MIN,220,50%,11:00:00
1023807,10,100-017-856.01-00,605001,M1,"KOMPLETTBEARBEITUNG: Flansch",04-06-2026,400,2,180,MIN,9.0,MIN,1980,3.0,MIN,5940,66%,07:00:00
1023807,20,100-017-856.01-00,603011,M2,"QUALITÄTSPRÜFUNG: 3D Messen",04-06-2026,400,20,30,MIN,2.5,MIN,80,0.5,MIN,40,25%,14:30:00
1023808,10,100-010-010.01-00,603012,M1,"FRÄSEN: Nuten 12H8",04-06-2026,600,10,90,MIN,6.0,MIN,450,2.0,MIN,900,40%,08:30:00
1023808,20,100-010-010.01-00,603010,M2,"BOHREN & SENKEN: 12x O6.5",04-06-2026,600,1,45,MIN,1.2,MIN,765,1.0,MIN,765,50%,12:00:00
1023809,10,100-008-200.01-00,603011,M2,"FRÄSEN: Freiformfläche",05-06-2026,140,1,120,MIN,15.0,MIN,2220,2.0,MIN,4440,80%,06:00:00
1023809,20,100-008-200.01-00,605001,M1,"POLIEREN & OBERFLÄCHE",05-06-2026,140,1,30,MIN,4.0,MIN,590,1.0,MIN,590,100%,13:30:00
1023810,10,100-010-092.01-00,603010,M2,"BEARBEITEN: OP 10 Drehen",05-06-2026,220,1,75,MIN,5.5,MIN,1285,1.5,MIN,1927.5,50%,07:30:00
1023810,20,100-010-092.01-00,603012,M1,"BEARBEITEN: OP 20 Fräsen",05-06-2026,220,1,60,MIN,4.2,MIN,984,1.5,MIN,1476,50%,12:30:00
1023811,10,100-010-577.01-00,605001,M1,"FRÄSEN: Gehäusedeckel OP1",06-06-2026,800,20,240,MIN,16.0,MIN,880,4.0,MIN,3520,60%,06:30:00
1023811,20,100-010-577.01-00,603011,M2,"FRÄSEN: Gehäusedeckel OP2",06-06-2026,800,20,120,MIN,8.5,MIN,460,2.0,MIN,920,50%,13:00:00
1023812,10,100-007-679.01-00,603012,M1,"REINIGEN: Ultraschallbad",06-06-2026,800,100,15,MIN,1.5,MIN,27,0.5,MIN,13.5,20%,16:00:00
1023812,20,100-007-679.01-00,603010,M2,"VERPACKUNG & LABELING",06-06-2026,800,50,20,MIN,0.8,MIN,32.8,0.5,MIN,16.4,20%,17:00:00
1023813,10,100-016-449.01-00,605001,M1,"DREHEN: Zapfen O45h6",08-06-2026,160,1,60,MIN,3.8,MIN,668,1.0,MIN,668,50%,08:00:00
1023813,20,100-016-449.01-00,603011,M2,"SCHLEIFEN: Zylinder O45h6",08-06-2026,160,1,90,MIN,6.2,MIN,1082,1.5,MIN,1623,75%,11:30:00
1023814,10,100-009-211.01-00,603010,M2,"BOHREN: Tiefloch Du. 8x120",08-06-2026,95,1,120,MIN,8.0,MIN,880,2.0,MIN,1760,100%,09:00:00
1023814,20,100-009-211.01-00,603012,M1,"HONEN: Bohrung O8H6",08-06-2026,95,1,45,MIN,4.5,MIN,472.5,1.0,MIN,472.5,50%,14:00:00
1023815,10,100-012-727.01-00,605001,M1,"VERZAHNEN: Modul 2.5 Z=32",09-06-2026,300,5,180,MIN,11.0,MIN,840,2.5,MIN,2100,50%,07:00:00
1023815,20,100-012-727.01-00,603011,M2,"HÄRTEN: Induktivhärten",09-06-2026,300,50,60,MIN,5.0,MIN,90,1.0,MIN,90,20%,13:30:00`
  },
  {
    id: "automotive_assembly",
    name: "Automotive Assembly Line",
    industry: "Automotive & Powertrain",
    description: "Multi-station vehicle assembly line with section assignments & worker headcount.",
    icon: "AUTO",
    filename: "test_automotive_assembly.csv",
    content: `Order No,Step No,Product Code,Assembly Line,Section,Description,Start Date,Quantity,Base Qty,Setup (mins),Unit,Process Time (mins),Unit,Sum total time,Manpower,Unit,Sum Manpower,Manpower %,Start Time
100601,10,AUTO-ENG-V6,Assy Line Alpha,A1,Sub-assembly Cylinder Head,01-06-2026,100,1,60,MIN,4.5,MIN,510,2,MIN,1020,50%,08:00:00
100601,20,AUTO-ENG-V6,Assy Line Beta,B1,Piston & Crankshaft Fitting,01-06-2026,100,1,90,MIN,8.0,MIN,890,3,MIN,2670,75%,11:00:00
100601,30,AUTO-ENG-V6,Assy Line Gamma,C1,Timing Belt & Cover Install,01-06-2026,100,1,45,MIN,3.5,MIN,395,1.5,MIN,592.5,50%,15:30:00
100602,10,AUTO-TRANS-8S,Assy Line Beta,B2,Gear Cluster Assembly,02-06-2026,150,1,75,MIN,5.0,MIN,825,2,MIN,1650,60%,07:30:00
100602,20,AUTO-TRANS-8S,Assy Line Alpha,A2,Clutch Housing Torqueing,02-06-2026,150,1,30,MIN,3.2,MIN,510,1,MIN,510,50%,12:00:00
100602,30,AUTO-TRANS-8S,Assy Line Gamma,C2,Hydraulic Valve Body Mount,02-06-2026,150,1,60,MIN,4.0,MIN,660,2,MIN,1320,50%,14:30:00
100603,10,AUTO-CHASS-EV,Assy Line Gamma,C1,Battery Pack Frame Mount,03-06-2026,80,1,120,MIN,12.0,MIN,1080,4,MIN,4320,80%,08:00:00
100603,20,AUTO-CHASS-EV,Assy Line Alpha,A1,Front & Rear Axle Drop,03-06-2026,80,1,90,MIN,9.5,MIN,850,3,MIN,2550,75%,12:30:00
100603,30,AUTO-CHASS-EV,Assy Line Beta,B1,High Voltage Wiring Connections,03-06-2026,80,1,45,MIN,6.0,MIN,525,2,MIN,1050,50%,15:00:00
100604,10,AUTO-BRAKE-SYS,Assy Line Alpha,A2,Caliper & Disc Mounting,04-06-2026,240,4,30,MIN,1.5,MIN,120,1,MIN,120,50%,08:30:00
100604,20,AUTO-BRAKE-SYS,Assy Line Beta,B2,Fluid Line Pressure Bleeding,04-06-2026,240,4,45,MIN,2.0,MIN,165,1,MIN,165,50%,10:30:00
100605,10,AUTO-STEER-EPS,Assy Line Gamma,C2,Rack & Pinion Assembly,04-06-2026,180,1,60,MIN,3.8,MIN,744,2,MIN,1488,50%,09:00:00
100605,20,AUTO-STEER-EPS,Assy Line Alpha,A1,Electronic Motor Calibration,04-06-2026,180,1,30,MIN,2.5,MIN,480,1,MIN,480,40%,13:30:00
100606,10,AUTO-EXHAUST-V,Assy Line Beta,B1,Manifold Welding & Gasket,05-06-2026,120,1,45,MIN,4.0,MIN,525,2,MIN,1050,60%,07:00:00
100606,20,AUTO-EXHAUST-V,Assy Line Gamma,C1,Catalytic Converter Clamp,05-06-2026,120,1,20,MIN,2.2,MIN,284,1,MIN,284,50%,10:30:00
100607,10,AUTO-BODY-HLD,Assy Line Alpha,A1,Robotic Door Hinge Welding,05-06-2026,300,2,90,MIN,2.8,MIN,510,2,MIN,1020,50%,11:30:00
100607,20,AUTO-BODY-HLD,Assy Line Beta,B2,Sealer & Primer Application,05-06-2026,300,2,60,MIN,1.8,MIN,330,1.5,MIN,495,40%,14:00:00
100608,10,AUTO-INT-DASH,Assy Line Gamma,C2,Dashboard Instrument Panel,06-06-2026,200,1,75,MIN,6.5,MIN,1375,2.5,MIN,3437.5,60%,08:00:00
100608,20,AUTO-INT-DASH,Assy Line Alpha,A2,Infotainment Display Harness,06-06-2026,200,1,30,MIN,3.0,MIN,630,1,MIN,630,50%,12:00:00
100609,10,AUTO-SEAT-SET,Assy Line Beta,B1,Leather Upholstery Stitching,06-06-2026,400,2,60,MIN,4.2,MIN,900,3,MIN,2700,75%,09:30:00
100609,20,AUTO-SEAT-SET,Assy Line Gamma,C1,Heating Element Insertion,06-06-2026,400,2,30,MIN,1.5,MIN,330,1,MIN,330,50%,14:00:00
100610,10,AUTO-SUSP-ADJ,Assy Line Alpha,A1,Coil Spring Assembly,08-06-2026,160,2,45,MIN,3.0,MIN,285,1.5,MIN,427.5,50%,07:30:00
100610,20,AUTO-SUSP-ADJ,Assy Line Beta,B2,Damper Valve Calibration,08-06-2026,160,2,60,MIN,4.0,MIN,380,2,MIN,760,50%,10:30:00
100611,10,AUTO-WHEEL-SET,Assy Line Gamma,C2,Tire Mounting & Balancing,08-06-2026,500,4,30,MIN,0.8,MIN,130,1,MIN,130,50%,12:00:00
100611,20,AUTO-WHEEL-SET,Assy Line Alpha,A2,TPMS Sensor Pairing,08-06-2026,500,4,15,MIN,0.4,MIN,65,0.5,MIN,32.5,25%,14:00:00
100612,10,AUTO-TEST-DYNO,Assy Line Beta,B1,End-of-Line Roll Dyno Test,09-06-2026,60,1,60,MIN,15.0,MIN,960,2,MIN,1920,80%,08:00:00
100612,20,AUTO-TEST-DYNO,Assy Line Gamma,C1,Final Inspection & Detailing,09-06-2026,60,1,30,MIN,10.0,MIN,630,1.5,MIN,945,50%,13:00:00
100613,10,AUTO-HVAC-UNIT,Assy Line Alpha,A1,Compressor & Condenser Assy,09-06-2026,140,1,45,MIN,4.5,MIN,675,2,MIN,1350,50%,09:30:00
100613,20,AUTO-HVAC-UNIT,Assy Line Beta,B2,R134a Refrigerant Charge,09-06-2026,140,1,20,MIN,2.0,MIN,300,1,MIN,300,40%,14:00:00`
  },
  {
    id: "electronics_smt",
    name: "Electronics SMT Lines",
    industry: "High-Tech Electronics",
    description: "PCB surface mount lines, reflow ovens, AOI & X-Ray inspection routines.",
    icon: "SMT",
    filename: "test_electronics_smt_lines.csv",
    content: `WorkOrder,OpStep,PartNo,SMTLine,WorkCenterGroup,OperationDesc,ScheduledDate,BatchQty,LotBaseQty,SetupMins,Unit,RunMinsPerUnit,Unit,OperatorHeadcount,ScheduledTime
WO-7010,10,PCB-MOTHER-V1,SMT Line 01,SMT-PICK,Solder Paste Stencil Printing,01-06-2026,500,100,45,MIN,0.15,MIN,1,08:00:00
WO-7010,20,PCB-MOTHER-V1,SMT Line 01,SMT-PICK,High Speed Component Pick & Place,01-06-2026,500,100,60,MIN,0.45,MIN,2,09:30:00
WO-7010,30,PCB-MOTHER-V1,SMT Line 02,SMT-REFLOW,10-Zone Reflow Soldering,01-06-2026,500,100,30,MIN,0.25,MIN,1,12:00:00
WO-7010,40,PCB-MOTHER-V1,SMT Line 02,AOI-INSPECT,3D Automated Optical Inspection,01-06-2026,500,100,15,MIN,0.10,MIN,1,14:00:00
WO-7011,10,PCB-POWER-SUP,SMT Line 03,SMT-PICK,Solder Paste Printing,02-06-2026,800,50,40,MIN,0.12,MIN,1,07:30:00
WO-7011,20,PCB-POWER-SUP,SMT Line 03,SMT-PICK,Fine Pitch BGA Placement,02-06-2026,800,50,75,MIN,0.60,MIN,2,09:00:00
WO-7011,30,PCB-POWER-SUP,SMT Line 04,SMT-REFLOW,Reflow Soldering Nitrogen,02-06-2026,800,50,30,MIN,0.30,MIN,1,13:00:00
WO-7012,10,PCB-WIFI-MOD,SMT Line 01,SMT-PICK,Micro-Stencil Printing 0201,03-06-2026,1200,200,60,MIN,0.08,MIN,1,08:00:00
WO-7012,20,PCB-WIFI-MOD,SMT Line 01,SMT-PICK,01005 Chip Component Mounting,03-06-2026,1200,200,90,MIN,0.22,MIN,2,10:00:00
WO-7012,30,PCB-WIFI-MOD,SMT Line 02,AOI-INSPECT,3D X-Ray Void Inspection,03-06-2026,1200,200,30,MIN,0.15,MIN,1,14:30:00
WO-7013,10,PCB-DISP-DRV,SMT Line 04,SMT-PICK,Flex Cable Connectors Mount,04-06-2026,350,50,45,MIN,0.35,MIN,1,08:30:00
WO-7013,20,PCB-DISP-DRV,SMT Line 04,SMT-REFLOW,Conformal Coating Application,04-06-2026,350,50,40,MIN,0.40,MIN,1,11:30:00
WO-7014,10,PCB-BMS-EV01,SMT Line 02,SMT-PICK,Dual Gantry Component Mount,04-06-2026,600,100,60,MIN,0.50,MIN,2,09:00:00
WO-7014,20,PCB-BMS-EV01,SMT Line 03,SMT-REFLOW,High Temp Alloy Reflow,04-06-2026,600,100,30,MIN,0.35,MIN,1,13:30:00
WO-7015,10,PCB-SENS-HUB,SMT Line 01,SMT-PICK,Sensor Die Attachment,05-06-2026,450,50,50,MIN,0.28,MIN,1,07:30:00
WO-7015,20,PCB-SENS-HUB,SMT Line 01,AOI-INSPECT,SPI Solder Inspection,05-06-2026,450,50,15,MIN,0.09,MIN,1,11:00:00
WO-7016,10,PCB-INV-600V,SMT Line 03,SMT-PICK,Heavy Copper Busbar Mount,05-06-2026,250,25,90,MIN,0.85,MIN,2,08:30:00
WO-7016,20,PCB-INV-600V,SMT Line 04,SMT-REFLOW,Vacuum Assisted Reflow,05-06-2026,250,25,45,MIN,0.60,MIN,1,13:00:00
WO-7017,10,PCB-CTRL-MCU,SMT Line 02,SMT-PICK,QFP & QFN Package Placement,06-06-2026,1000,100,60,MIN,0.25,MIN,2,08:00:00
WO-7017,20,PCB-CTRL-MCU,SMT Line 02,AOI-INSPECT,Post-Reflow AOI Scan,06-06-2026,1000,100,20,MIN,0.12,MIN,1,11:30:00
WO-7018,10,PCB-AUDIO-DAC,SMT Line 01,SMT-PICK,Gold-plated Pad Stencil,06-06-2026,300,50,30,MIN,0.20,MIN,1,09:00:00
WO-7018,20,PCB-AUDIO-DAC,SMT Line 01,SMT-REFLOW,Vapor Phase Soldering,06-06-2026,300,50,45,MIN,0.40,MIN,1,12:30:00
WO-7019,10,PCB-RF-TRANS,SMT Line 04,SMT-PICK,Shielding Can Placement,08-06-2026,750,100,50,MIN,0.18,MIN,1,08:00:00
WO-7019,20,PCB-RF-TRANS,SMT Line 04,AOI-INSPECT,High Frequency RF Test,08-06-2026,750,100,40,MIN,0.30,MIN,2,11:00:00
WO-7020,10,PCB-GATE-DRV,SMT Line 03,SMT-PICK,Optocoupler Mounting,08-06-2026,400,50,40,MIN,0.22,MIN,1,09:30:00
WO-7020,20,PCB-GATE-DRV,SMT Line 03,SMT-REFLOW,Pin-in-Paste Reflow,08-06-2026,400,50,30,MIN,0.28,MIN,1,13:30:00
WO-7021,10,PCB-LED-ARRAY,SMT Line 01,SMT-PICK,High Power LED Placement,09-06-2026,1500,250,30,MIN,0.05,MIN,1,07:30:00
WO-7021,20,PCB-LED-ARRAY,SMT Line 02,SMT-REFLOW,Aluminum Substrate Reflow,09-06-2026,1500,250,35,MIN,0.15,MIN,1,10:30:00
WO-7022,10,PCB-FIRM-PROG,SMT Line 04,AOI-INSPECT,In-Circuit Bed of Nails Test,09-06-2026,500,50,60,MIN,0.40,MIN,2,08:30:00
WO-7022,20,PCB-FIRM-PROG,SMT Line 04,AOI-INSPECT,Automatic Firmware Flash,09-06-2026,500,50,20,MIN,0.15,MIN,1,12:30:00`
  },
  {
    id: "aerospace_fab",
    name: "Aerospace Precision Fab",
    industry: "Aerospace & Defense",
    description: "Turbine blades, wing spars, Inconel LMD 3D printing & NDT C-Scan testing.",
    icon: "AERO",
    filename: "test_aerospace_precision_fab.csv",
    content: `JobID,OpSeq,ComponentID,MachineID,CellGroup,ProcessSpecification,TargetDate,BatchCount,BaseUnit,PrepTimeMins,Unit,CycleTimeMins,Unit,TechsRequired,LaunchTime
AERO-901,10,COMP-TURB-BLD,CNC-5AXIS-01,CELL-TURB,"5-Axis CNC Milling Titanium Blade",01-06-2026,45,1,180,MIN,42.0,MIN,2,07:00:00
AERO-901,20,COMP-TURB-BLD,EDM-WIRE-02,CELL-TURB,"Wire EDM Root Serration Profiling",01-06-2026,45,1,90,MIN,28.5,MIN,1,13:30:00
AERO-901,30,COMP-TURB-BLD,COAT-THERM-01,CELL-SURF,"Thermal Barrier Plasma Coating",02-06-2026,45,5,120,MIN,15.0,MIN,2,08:30:00
AERO-902,10,COMP-WING-SPR,MILL-GANTRY-01,CELL-STRUC,"Gantry Milling Aluminum 7075 Spar",02-06-2026,12,1,240,MIN,180.0,MIN,3,06:30:00
AERO-902,20,COMP-WING-SPR,NDT-USOUND-01,CELL-QUAL,"Ultrasonic NDT C-Scan Flaw Detect",02-06-2026,12,1,60,MIN,45.0,MIN,2,14:00:00
AERO-903,10,COMP-FUS-RIBS,CNC-5AXIS-02,CELL-STRUC,"5-Axis Machining Fuselage Ribs",03-06-2026,60,2,150,MIN,35.0,MIN,2,07:30:00
AERO-903,20,COMP-FUS-RIBS,DEBURR-ROB-01,CELL-SURF,"Robotic Deburring & Edge Radius",03-06-2026,60,2,45,MIN,12.0,MIN,1,12:00:00
AERO-904,10,COMP-ENG-NOZZ,LMD-3DPRN-01,CELL-ADDIT,"Laser Metal Deposition Inconel 718",03-06-2026,8,1,300,MIN,210.0,MIN,2,08:00:00
AERO-904,20,COMP-ENG-NOZZ,HIP-PRESS-01,CELL-HEAT,"Hot Isostatic Pressing Heat Treat",04-06-2026,8,8,180,MIN,360.0,MIN,2,06:00:00
AERO-905,10,COMP-LAND-GEAR,LATHE-HEAVY-01,CELL-LAND,"Heavy Turning High-Strength Steel",04-06-2026,20,1,120,MIN,85.0,MIN,2,08:30:00
AERO-905,20,COMP-LAND-GEAR,GRIND-CYL-01,CELL-LAND,"Precision Grinding Piston Shaft",04-06-2026,20,1,90,MIN,55.0,MIN,1,13:00:00
AERO-906,10,COMP-BRK-DISC,CARB-CVD-01,CELL-SURF,"CVD Carbon-Carbon Composite Cure",05-06-2026,100,10,210,MIN,120.0,MIN,3,07:00:00
AERO-906,20,COMP-BRK-DISC,BAL-DYNAMIC-01,CELL-QUAL,"High Speed Dynamic Balance Test",05-06-2026,100,5,45,MIN,18.0,MIN,1,14:00:00
AERO-907,10,COMP-COCK-FRM,CNC-5AXIS-01,CELL-STRUC,"5-Axis Pocketing Windshield Frame",05-06-2026,15,1,180,MIN,115.0,MIN,2,08:00:00
AERO-907,20,COMP-COCK-FRM,ANOD-BATH-01,CELL-SURF,"Chromic Acid Anodizing Bath",06-06-2026,15,15,90,MIN,40.0,MIN,2,09:00:00
AERO-908,10,COMP-APU-HOUS,CAST-INVEST-01,CELL-TURB,"Investment Casting Shell Molding",06-06-2026,30,1,150,MIN,65.0,MIN,2,08:30:00
AERO-908,20,COMP-APU-HOUS,XRAY-CT-01,CELL-QUAL,"3D Computed Tomography Inspection",06-06-2026,30,5,60,MIN,25.0,MIN,1,13:30:00
AERO-909,10,COMP-PROP-HUB,MILL-GANTRY-01,CELL-STRUC,"Gantry Milling Hub Forging",08-06-2026,25,1,210,MIN,95.0,MIN,2,07:00:00
AERO-909,20,COMP-PROP-HUB,BROACH-SPLN-01,CELL-STRUC,"Internal Spline Broaching",08-06-2026,25,1,75,MIN,22.0,MIN,1,12:30:00
AERO-910,10,COMP-FUEL-MPMP,CNC-5AXIS-02,CELL-TURB,"Impeller 5-Axis Milling",08-06-2026,80,2,120,MIN,38.0,MIN,2,08:30:00
AERO-910,20,COMP-FUEL-MPMP,FLOW-BENCH-01,CELL-QUAL,"Hydraulic Flow Calibration Bench",08-06-2026,80,4,45,MIN,15.0,MIN,1,14:00:00
AERO-911,10,COMP-DUCT-BLEED,HYDRO-FORM-01,CELL-STRUC,"Hydroforming Thin-Wall Ducting",09-06-2026,110,5,90,MIN,14.0,MIN,2,07:30:00
AERO-911,20,COMP-DUCT-BLEED,WELD-TIG-01,CELL-STRUC,"Orbital TIG Flange Welding",09-06-2026,110,1,60,MIN,18.0,MIN,1,11:30:00
AERO-912,10,COMP-RUDD-ACTU,LATHE-HEAVY-01,CELL-LAND,"Servo Cylinder Lathe Turning",09-06-2026,40,1,105,MIN,48.0,MIN,1,08:00:00
AERO-912,20,COMP-RUDD-ACTU,GRIND-CYL-01,CELL-LAND,"Chrome Plating Grinding",09-06-2026,40,1,75,MIN,32.0,MIN,1,12:00:00
AERO-913,10,COMP-AVIO-RACK,CNC-5AXIS-01,CELL-STRUC,"Avionics Bay Sheet Metal Rack",10-06-2026,150,10,90,MIN,12.5,MIN,1,08:30:00
AERO-913,20,COMP-AVIO-RACK,COAT-THERM-01,CELL-SURF,"EMI Shielding Powder Coat",10-06-2026,150,25,45,MIN,8.0,MIN,1,13:00:00
AERO-914,10,COMP-PYLN-PIN,LATHE-HEAVY-01,CELL-LAND,"Titanium Shear Pin Machining",10-06-2026,200,5,120,MIN,16.0,MIN,2,07:30:00
AERO-914,20,COMP-PYLN-PIN,NDT-USOUND-01,CELL-QUAL,"Magnetic Particle Flaw Detect",10-06-2026,200,20,30,MIN,5.0,MIN,1,12:00:00`
  },
  {
    id: "medical_cleanroom",
    name: "Medical Device Cleanroom",
    industry: "Medical & Life Sciences",
    description: "ISO7 Cleanroom titanium implants, cardiac stents, catheter extrusion & gamma packaging.",
    icon: "MED",
    filename: "test_medical_device_manufacturing.csv",
    content: `OrderNum,ProcessSeq,SKU,WorkstationID,Department,ProcessName,ReleaseDate,OrderQuantity,BaseRatio,ChangeoverTime,Unit,ExecutionTime,Unit,Operators,ShiftStart
MED-5010,10,IMP-HIP-TIT,MILL-CLEAN-01,CLEANROOM-ISO7,Laser Sintering Titanium Implant,01-06-2026,120,1,120,MIN,25.0,MIN,2,07:00:00
MED-5010,20,IMP-HIP-TIT,MILL-CLEAN-02,CLEANROOM-ISO7,5-Axis Passivation & Polishing,01-06-2026,120,1,60,MIN,14.5,MIN,1,12:00:00
MED-5010,30,IMP-HIP-TIT,STERIL-PACK-01,CLEANROOM-ISO5,Gamma Radiation Pouched Pack,01-06-2026,120,10,45,MIN,3.5,MIN,1,15:30:00
MED-5011,10,STENT-CARD-CO,LASER-CUT-01,CLEANROOM-ISO7,Femtosecond Laser Nitinol Cutting,02-06-2026,500,20,90,MIN,2.2,MIN,2,08:00:00
MED-5011,20,STENT-CARD-CO,MILL-CLEAN-02,CLEANROOM-ISO7,Chemical Electropolishing Bath,02-06-2026,500,50,60,MIN,1.8,MIN,1,11:30:00
MED-5011,30,STENT-CARD-CO,STERIL-PACK-01,CLEANROOM-ISO5,Drug Eluting Coating Spray,02-06-2026,500,20,90,MIN,4.0,MIN,2,14:00:00
MED-5012,10,CATH-BALLOON,EXTRUDE-LINE-01,PLASTICS-MED,Pebax Micro-Tubing Extrusion,03-06-2026,2500,500,150,MIN,0.12,MIN,2,06:30:00
MED-5012,20,CATH-BALLOON,MILL-CLEAN-01,CLEANROOM-ISO7,Balloon Heat Forming & Bond,03-06-2026,2500,100,60,MIN,0.45,MIN,3,10:30:00
MED-5012,30,CATH-BALLOON,STERIL-PACK-01,CLEANROOM-ISO5,Tyvek Pouch Sealing & ETO Steril,03-06-2026,2500,250,45,MIN,0.20,MIN,2,15:00:00
MED-5013,10,SYR-PREFILL-1K,INJECT-MOLD-01,PLASTICS-MED,Cyclo-Olefin Syringe Barrel Mold,04-06-2026,10000,1000,180,MIN,0.04,MIN,2,07:00:00
MED-5013,20,SYR-PREFILL-1K,STERIL-PACK-01,CLEANROOM-ISO5,Siliconization & Needle Stake,04-06-2026,10000,500,90,MIN,0.08,MIN,3,11:00:00
MED-5014,10,PACEMAK-TI,MILL-CLEAN-01,CLEANROOM-ISO7,Laser Hermetic Can Welding,04-06-2026,80,1,120,MIN,18.0,MIN,2,08:30:00
MED-5014,20,PACEMAK-TI,MILL-CLEAN-02,CLEANROOM-ISO7,Feedthrough Leak Detector Test,04-06-2026,80,1,45,MIN,8.5,MIN,1,12:30:00
MED-5015,10,DIALYZ-FLTR,EXTRUDE-LINE-01,PLASTICS-MED,Polysulfone Fiber Spinning,05-06-2026,1500,100,120,MIN,0.85,MIN,2,07:30:00
MED-5015,20,DIALYZ-FLTR,STERIL-PACK-01,CLEANROOM-ISO5,Potting & Centrifugal Trimming,05-06-2026,1500,50,60,MIN,0.60,MIN,2,12:00:00
MED-5016,10,KNEE-POLY-HLD,MILL-CLEAN-01,CLEANROOM-ISO7,UHMWPE Joint Insert Milling,05-06-2026,200,2,90,MIN,12.0,MIN,1,08:00:00
MED-5016,20,KNEE-POLY-HLD,STERIL-PACK-01,CLEANROOM-ISO5,Ethylene Oxide Gas Sterilization,05-06-2026,200,20,45,MIN,2.5,MIN,1,13:30:00
MED-5017,10,SURG-SCALPEL,LASER-CUT-01,CLEANROOM-ISO7,Precision Stainless Blade Grind,06-06-2026,4000,500,60,MIN,0.05,MIN,1,08:00:00
MED-5017,20,SURG-SCALPEL,STERIL-PACK-01,CLEANROOM-ISO5,Plastic Handle Overmolding,06-06-2026,4000,500,75,MIN,0.12,MIN,2,11:00:00
MED-5018,10,IV-TUBING-SET,EXTRUDE-LINE-01,PLASTICS-MED,PVC Free Co-Extrusion Line,06-06-2026,3000,300,90,MIN,0.15,MIN,2,07:00:00
MED-5018,20,IV-TUBING-SET,STERIL-PACK-01,CLEANROOM-ISO5,Luer Lock Fitting Solvent Bond,06-06-2026,3000,100,45,MIN,0.25,MIN,3,11:30:00
MED-5019,10,DENT-CROWN-3D,MILL-CLEAN-02,CLEANROOM-ISO7,Zirconia Block Dental Milling,08-06-2026,350,5,45,MIN,8.0,MIN,1,08:30:00
MED-5019,20,DENT-CROWN-3D,MILL-CLEAN-01,CLEANROOM-ISO7,High-Temp Sintering Furnace,08-06-2026,350,50,30,MIN,12.0,MIN,1,12:00:00
MED-5020,10,HEART-VALV-BO,LASER-CUT-01,CLEANROOM-ISO7,Bovine Pericardium Tissue Cut,08-06-2026,60,1,150,MIN,45.0,MIN,3,07:30:00
MED-5020,20,HEART-VALV-BO,STERIL-PACK-01,CLEANROOM-ISO5,Micro-Suture Frame Assembly,08-06-2026,60,1,60,MIN,90.0,MIN,4,11:30:00
MED-5021,10,BONE-SCREW-TI,LASER-CUT-01,CLEANROOM-ISO7,Swiss Lathe Screw Machining,09-06-2026,1800,100,90,MIN,0.40,MIN,2,08:00:00
MED-5021,20,BONE-SCREW-TI,MILL-CLEAN-02,CLEANROOM-ISO7,Anodized Color Coding Bath,09-06-2026,1800,200,40,MIN,0.15,MIN,1,12:30:00
MED-5022,10,GLUCO-SENS-CH,INJECT-MOLD-01,PLASTICS-MED,Reagent Microfluidic Strip Printing,09-06-2026,8000,1000,120,MIN,0.02,MIN,2,07:00:00
MED-5022,20,GLUCO-SENS-CH,STERIL-PACK-01,CLEANROOM-ISO5,Desiccant Foil Blister Packaging,09-06-2026,8000,500,60,MIN,0.05,MIN,2,11:00:00`
  },
  {
    id: "plastics_molding",
    name: "Plastics Injection Molding",
    industry: "Consumer & Industrial Plastics",
    description: "Multi-cavity molding machines, robotic gate trimming & pad printing operations.",
    icon: "PLAST",
    filename: "test_plastics_injection_molding.csv",
    content: `MoldJob,Step,ResinPartNo,MoldingMachine,MachineFamily,MoldOperation,PlannedDate,TotalQuantity,UnitBase,MoldChangeMins,Unit,CycleSecsPerPart,Unit,SetterCount,StartTime
INJ-4010,10,CONTAIN-LID-5L,PRESS-MOLD-500T,FAM-HEAVY,"Multi-Cavity Lid Molding",01-06-2026,5000,500,90,MIN,8.5,SEC,2,07:00:00
INJ-4010,20,CONTAIN-LID-5L,ROB-DEBURR-01,FAM-POST,"Robotic Gate Trimming & Stacking",01-06-2026,5000,500,30,MIN,4.2,SEC,1,11:30:00
INJ-4011,10,BOTTLE-CAP-28,PRESS-MOLD-300T,FAM-SPEED,"32-Cavity High Speed Cap Mold",01-06-2026,25000,2500,120,MIN,2.1,SEC,2,08:00:00
INJ-4011,20,BOTTLE-CAP-28,PRINT-TAMP-01,FAM-POST,"Tamper Evident Liner Insertion",01-06-2026,25000,2500,45,MIN,1.5,SEC,1,14:00:00
INJ-4012,10,HOUS-DRIL-C2,PRESS-MOLD-500T,FAM-HEAVY,"ABS/PC Power Tool Housing Left",02-06-2026,2000,200,75,MIN,14.0,SEC,2,07:30:00
INJ-4012,20,HOUS-DRIL-C2,PRESS-MOLD-500T,FAM-HEAVY,"ABS/PC Power Tool Housing Right",02-06-2026,2000,200,60,MIN,14.0,SEC,2,11:30:00
INJ-4013,10,PALLET-HD-BLK,PRESS-MOLD-1200T,FAM-EXTRA,"Recycled HDPE Heavy Duty Pallet",03-06-2026,400,20,240,MIN,45.0,SEC,3,06:30:00
INJ-4013,20,PALLET-HD-BLK,ROB-DEBURR-01,FAM-POST,"Anti-Slip Rubber Grommet Insert",03-06-2026,400,20,45,MIN,15.0,SEC,1,13:00:00
INJ-4014,10,GEAR-POM-WHITE,PRESS-MOLD-150T,FAM-PREC,"Polyacetal Precision Gear Mold",03-06-2026,8000,1000,60,MIN,6.0,SEC,1,08:00:00
INJ-4014,20,GEAR-POM-WHITE,ANOD-BATH-01,FAM-POST,"Annealing Moisture Conditioning",03-06-2026,8000,1000,30,MIN,12.0,SEC,1,12:30:00
INJ-4015,10,CONNECT-AUT01,PRESS-MOLD-150T,FAM-PREC,"PBT 16-Pin Automotive Connector",04-06-2026,12000,1000,90,MIN,3.5,SEC,2,07:00:00
INJ-4015,20,CONNECT-AUT01,PRINT-TAMP-01,FAM-POST,"Pin Terminal Insertion Check",04-06-2026,12000,1000,45,MIN,2.0,SEC,1,12:00:00
INJ-4016,10,SYRINGE-PL-10,PRESS-MOLD-300T,FAM-SPEED,"Medical Grade PP Barrel Molding",04-06-2026,30000,3000,150,MIN,1.8,SEC,2,08:30:00
INJ-4016,20,SYRINGE-PL-10,PRINT-TAMP-01,FAM-POST,"Graduation Scale Silk Printing",04-06-2026,30000,3000,60,MIN,1.2,SEC,1,14:30:00
INJ-4017,10,KEYCAP-PBT-DB,PRESS-MOLD-150T,FAM-PREC,"Double-Shot Keycap Inbound",05-06-2026,15000,1500,90,MIN,2.5,SEC,2,07:30:00
INJ-4017,20,KEYCAP-PBT-DB,PRESS-MOLD-150T,FAM-PREC,"Double-Shot Legend Overmold",05-06-2026,15000,1500,90,MIN,2.8,SEC,2,11:30:00
INJ-4018,10,BUMPER-GRILLE,PRESS-MOLD-1200T,FAM-EXTRA,"Chrome Plating Grade ABS Grille",05-06-2026,600,50,180,MIN,28.0,SEC,3,08:00:00
INJ-4018,20,BUMPER-GRILLE,ROB-DEBURR-01,FAM-POST,"Edge Inspection & Gate Cut",05-06-2026,600,50,30,MIN,8.0,SEC,1,13:30:00
INJ-4019,10,TOY-FIGURE-A,PRESS-MOLD-300T,FAM-SPEED,"Multi-Color Action Figure Part",06-06-2026,10000,1000,60,MIN,4.0,SEC,2,07:00:00
INJ-4019,20,TOY-FIGURE-A,PRINT-TAMP-01,FAM-POST,"Pad Printing Eyes & Details",06-06-2026,10000,1000,45,MIN,2.5,SEC,1,11:30:00
INJ-4020,10,LENS-PC-CLEAR,PRESS-MOLD-300T,FAM-PREC,"Optical Grade PC Headlamp Lens",06-06-2026,1800,150,120,MIN,18.0,SEC,2,09:00:00
INJ-4020,20,LENS-PC-CLEAR,ANOD-BATH-01,FAM-POST,"Hardcoat Anti-Scratch Dip",06-06-2026,1800,150,60,MIN,10.0,SEC,1,14:00:00
INJ-4021,10,FAN-BLADE-AC,PRESS-MOLD-500T,FAM-HEAVY,"Glass-filled Nylon Fan Impeller",08-06-2026,2400,200,90,MIN,11.0,SEC,2,08:00:00
INJ-4021,20,FAN-BLADE-AC,ROB-DEBURR-01,FAM-POST,"Dynamic Spin Balancing Test",08-06-2026,2400,200,45,MIN,5.0,SEC,1,12:30:00
INJ-4022,10,HELMET-SHELL,PRESS-MOLD-1200T,FAM-EXTRA,"Impact Resistant Polycarbonate Shell",08-06-2026,1200,100,150,MIN,22.0,SEC,3,07:30:00
INJ-4022,20,HELMET-SHELL,ROB-DEBURR-01,FAM-POST,"Visor Hinge Hole Drilling",08-06-2026,1200,100,30,MIN,6.0,SEC,1,13:00:00
INJ-4023,10,CRATE-MILK-24,PRESS-MOLD-1200T,FAM-EXTRA,"HDPE Stackable Dairy Crate",09-06-2026,1500,100,180,MIN,32.0,SEC,3,07:00:00
INJ-4023,20,CRATE-MILK-24,PRINT-TAMP-01,FAM-POST,"Hot Stamp Logo Branding",09-06-2026,1500,100,45,MIN,4.0,SEC,1,13:00:00`
  }
];

export interface ExpectedColumnSpec {
  field: string;
  label: string;
  required: boolean;
  aliases: string[];
  description: string;
  example: string;
}

export const EXPECTED_COLUMNS_SPEC: ExpectedColumnSpec[] = [
  {
    field: "order",
    label: "Order ID",
    required: true,
    aliases: ["Order", "Order No", "Auftrag", "WorkOrder", "JobID", "OrderNum", "PressOrder", "TicketNo", "BatchID", "WaferLot"],
    description: "Unique identifier for the parent work order or production batch.",
    example: "1023801 / WO-7010 / AERO-901"
  },
  {
    field: "processId",
    label: "Step / Operation ID",
    required: true,
    aliases: ["Order Process ID", "Step No", "Vorgang", "OpStep", "OpSeq", "ProcessSeq", "StepNumber", "Step", "OpNo", "StepSeq"],
    description: "Sequence number of the operation step (e.g. 10, 20, 30).",
    example: "10, 20, 30"
  },
  {
    field: "material",
    label: "Material / SKU / Part",
    required: true,
    aliases: ["Material", "Product Code", "Materialnr", "PartNo", "ComponentID", "SKU", "DiePartNo", "ResinPartNo", "GarmentSKU", "BeverageSKU", "DeviceID"],
    description: "Part number, product code, or raw material specification.",
    example: "100-024-830.01-00 / PCB-MOTHER-V1"
  },
  {
    field: "machine",
    label: "Machine / Line / Workstation",
    required: true,
    aliases: ["Machine", "Assembly Line", "Maschine", "SMTLine", "MachineID", "WorkstationID", "PressMachine", "MoldingMachine", "SewingLine", "PackagingLine", "ClusterTool"],
    description: "Target workstation, assembly line, or machine assigned.",
    example: "603011 / Line Alpha / SMT Line 01"
  },
  {
    field: "sopStartDate",
    label: "SOP Start Date",
    required: true,
    aliases: ["SOP Start Date", "Start Date", "Startdatum", "ScheduledDate", "TargetDate", "ReleaseDate", "PlannedDate", "Date SOP", "ProductionDate"],
    description: "Start of Production release date constraint.",
    example: "01-06-2026 / 2026-06-01 / 01 July 2026"
  },
  {
    field: "qty",
    label: "Order Quantity",
    required: true,
    aliases: ["Order QTY", "Quantity", "Menge", "BatchQty", "BatchCount", "OrderQuantity", "QtyProduced", "TotalQuantity", "Volume", "Pieces", "CasesCount", "WaferCount"],
    description: "Total parts or units to produce for this order.",
    example: "120, 500, 1000"
  },
  {
    field: "setupTime",
    label: "Setup Time (Mins)",
    required: false,
    aliases: ["Set up Time", "Setup (mins)", "Rustzeit", "SetupMins", "PrepTimeMins", "ChangeoverTime", "DieSetupMins", "MoldChangeMins", "Setup Duration", "LineSetupMins", "LineSanitizationMins", "RecipeSetupMins"],
    description: "Fixed machine changeover or setup time in minutes (not quantity dependent).",
    example: "45, 60, 120"
  },
  {
    field: "processTime",
    label: "Processing Time per Base Qty",
    required: false,
    aliases: ["Process time", "Process Time (mins)", "Bearbeitungszeit", "RunMinsPerUnit", "CycleTimeMins", "ExecutionTime", "PressCycleMins", "CycleSecsPerPart", "Processing Duration", "SewingMinsPerPiece", "FillMinsPerCase", "EtchMinsPerWafer"],
    description: "Time required to process the base quantity.",
    example: "4.5, 12.0, 0.15"
  },
  {
    field: "manpower",
    label: "Manpower / Operators Required",
    required: false,
    aliases: ["Manpower Utilization", "Manpower", "Bediener", "OperatorHeadcount", "TechsRequired", "Operators", "CrewSize", "SetterCount", "LineWorkers", "OperatorsNeeded", "EngineersRequired"],
    description: "Number of operators or setup technicians needed.",
    example: "1, 2, 3"
  }
];
