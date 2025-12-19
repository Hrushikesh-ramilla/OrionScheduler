"use client";

import { useReactFlow, useNodes } from "reactflow";
import { TaskNodeData } from "./TaskNode";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings2 } from "lucide-react";

export function NodeConfigPanel() {
  const { setNodes } = useReactFlow();
  const nodes = useNodes();
  const selectedNode = nodes.find((n) => n.selected);

  if (!selectedNode) {
    return (
      <div className="w-80 border-l bg-card p-6 flex flex-col items-center justify-center text-center text-muted-foreground min-h-[600px]">
        <Settings2 className="w-12 h-12 mb-4 opacity-50" />
        <p>Select a node on the canvas to configure its properties.</p>
      </div>
    );
  }

  const data = selectedNode.data as TaskNodeData;

  const updateNodeData = (key: string, value: any) => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === selectedNode.id) {
          return { ...n, data: { ...n.data, [key]: value } };
        }
        return n;
      })
    );
  };

  return (
    <div className="w-80 border-l bg-card p-6 min-h-[600px] flex flex-col gap-6">
      <div>
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <Settings2 className="w-5 h-5" />
          Configure Task
        </h3>
        <p className="text-sm text-muted-foreground">Properties for {data.label}</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Label>Task ID (Label)</Label>
          <Input 
            value={data.label} 
            onChange={(e) => updateNodeData("label", e.target.value)} 
          />
        </div>

        <div className="space-y-2">
          <Label>Payload Type</Label>
          <Select 
            value={data.payload} 
            onValueChange={(val) => updateNodeData("payload", val)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="work">Work (Fast)</SelectItem>
              <SelectItem value="sleep">Sleep (Slow / Demo)</SelectItem>
              <SelectItem value="fail">Crash / Fail</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Priority (1 = highest)</Label>
          <Input 
            type="number" 
            min="1" 
            max="10" 
            value={data.priority} 
            onChange={(e) => updateNodeData("priority", parseInt(e.target.value) || 1)} 
          />
        </div>
      </div>
    </div>
  );
}
