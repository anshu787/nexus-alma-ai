import { useRef, useMemo, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, Text, Billboard } from "@react-three/drei";
import * as THREE from "three";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface NodeData {
  id: string;
  name: string;
  type: "alumni" | "company";
  x: number;
  y: number;
  z: number;
}

function NodeSphere({ position, color, size, name }: { position: [number, number, number]; color: string; size: number; name: string }) {
  const meshRef = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (meshRef.current) meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime + position[0]) * 0.05;
  });
  return (
    <group>
      <mesh ref={meshRef} position={position}>
        <sphereGeometry args={[size, 32, 32]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={0.3} roughness={0.3} metalness={0.6} />
      </mesh>
      <Billboard position={[position[0], position[1] + size + 0.3, position[2]]}>
        <Text fontSize={0.18} color="#94a3b8" anchorX="center" anchorY="middle" font={undefined}>{name}</Text>
      </Billboard>
    </group>
  );
}

function ConnectionLine({ start, end }: { start: [number, number, number]; end: [number, number, number] }) {
  const geometry = useMemo(() => new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...start), new THREE.Vector3(...end)]), [start, end]);
  const material = useMemo(() => new THREE.LineBasicMaterial({ color: "#334155", opacity: 0.4, transparent: true }), []);
  return <primitive object={new THREE.Line(geometry, material)} />;
}

function Scene({ alumniNodes, companyNodes, connections }: { alumniNodes: NodeData[]; companyNodes: NodeData[]; connections: [string, string][] }) {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((state) => { if (groupRef.current) groupRef.current.rotation.y = state.clock.elapsedTime * 0.03; });

  const allNodes = [...alumniNodes, ...companyNodes];
  const nodeMap = useMemo(() => {
    const map: Record<string, { x: number; y: number; z: number }> = {};
    allNodes.forEach((n) => { map[n.id] = { x: n.x, y: n.y, z: n.z }; });
    return map;
  }, [allNodes]);

  return (
    <group ref={groupRef}>
      <ambientLight intensity={0.4} />
      <pointLight position={[10, 10, 10]} intensity={0.8} />
      <pointLight position={[-10, -10, -10]} intensity={0.3} color="#f59e0b" />
      {connections.map(([from, to], i) => {
        const a = nodeMap[from]; const b = nodeMap[to];
        if (!a || !b) return null;
        return <ConnectionLine key={i} start={[a.x, a.y, a.z]} end={[b.x, b.y, b.z]} />;
      })}
      {alumniNodes.map((n) => <NodeSphere key={n.id} position={[n.x, n.y, n.z]} color="#f59e0b" size={0.2} name={n.name} />)}
      {companyNodes.map((n) => <NodeSphere key={n.id} position={[n.x, n.y, n.z]} color="#3b82f6" size={0.3} name={n.name} />)}
    </group>
  );
}

export default function NetworkGraph() {
  const [alumniNodes, setAlumniNodes] = useState<NodeData[]>([]);
  const [companyNodes, setCompanyNodes] = useState<NodeData[]>([]);
  const [connections, setConnections] = useState<[string, string][]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      // Fetch profiles for alumni nodes
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name, company").limit(30);
      // Fetch connections
      const { data: conns } = await supabase.from("connections").select("source_user_id, target_user_id").limit(50);

      const pList = profiles || [];
      const companies = new Set<string>();
      pList.forEach(p => { if (p.company) companies.add(p.company); });

      // Position alumni in a circle
      const aNodes: NodeData[] = pList.map((p, i) => {
        const angle = (i / pList.length) * Math.PI * 2;
        const radius = 3;
        return {
          id: p.user_id,
          name: p.full_name || "Unknown",
          type: "alumni" as const,
          x: Math.cos(angle) * radius + (Math.random() - 0.5),
          y: (Math.random() - 0.5) * 2,
          z: Math.sin(angle) * radius + (Math.random() - 0.5),
        };
      });

      // Position companies in an outer ring
      const compArr = Array.from(companies);
      const cNodes: NodeData[] = compArr.map((name, i) => {
        const angle = (i / compArr.length) * Math.PI * 2;
        return {
          id: `company-${name}`,
          name,
          type: "company" as const,
          x: Math.cos(angle) * 5,
          y: (Math.random() - 0.5),
          z: Math.sin(angle) * 5,
        };
      });

      // Build connections: user-to-user from DB, user-to-company from profiles
      const edges: [string, string][] = [];
      (conns || []).forEach(c => edges.push([c.source_user_id, c.target_user_id]));
      pList.forEach(p => { if (p.company) edges.push([p.user_id, `company-${p.company}`]); });

      setAlumniNodes(aNodes);
      setCompanyNodes(cNodes);
      setConnections(edges);
      setLoading(false);
    };
    fetchData();
  }, []);

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin text-accent" /></div>;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-heading font-bold text-foreground">Alumni Network Graph</h1>
        <p className="text-muted-foreground text-sm">Interactive 3D visualization — {alumniNodes.length} alumni, {companyNodes.length} companies</p>
      </div>
      <div className="bg-card border border-border rounded-xl overflow-hidden shadow-card" style={{ height: "calc(100vh - 12rem)" }}>
        <div className="flex items-center gap-4 px-4 py-2 border-b border-border bg-secondary/50">
          <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-accent" /><span className="text-xs text-muted-foreground">Alumni</span></div>
          <div className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-full bg-info" /><span className="text-xs text-muted-foreground">Companies</span></div>
          <span className="text-xs text-muted-foreground ml-auto">Drag to rotate • Scroll to zoom</span>
        </div>
        <Canvas camera={{ position: [0, 0, 8], fov: 60 }} style={{ background: "hsl(222, 60%, 6%)" }}>
          <Scene alumniNodes={alumniNodes} companyNodes={companyNodes} connections={connections} />
          <OrbitControls enablePan enableZoom enableRotate dampingFactor={0.1} />
        </Canvas>
      </div>
    </div>
  );
}
