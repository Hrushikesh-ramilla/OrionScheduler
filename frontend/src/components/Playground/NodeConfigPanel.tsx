"use client";

import { useReactFlow, useNodes } from "reactflow";
import { TaskNodeData } from "./TaskNode";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Settings2, Plus, Trash2 } from "lucide-react";

export function NodeConfigPanel() {
  const { setNodes } = useReactFlow();
  const nodes = useNodes();
  const selectedNode = nodes.find((n) => n.selected);

  const handleAddNode = () => {
    const newNodeId = `T${nodes.length + 1}`;
    const newNode = {
      id: newNodeId,
      type: "task",
      position: { x: Math.random() * 200 + 100, y: Math.random() * 200 + 100 },
      data: { label: newNodeId, payload: "work", status: "pending", priority: 1, duration: 1000 },
    };
    setNodes((nds) => [...nds, newNode]);
  };

  const handleDeleteNode = () => {
    if (selectedNode) {
      setNodes((nds) => nds.filter((n) => n.id !== selectedNode.id));
    }
  };

  if (!selectedNode) {
    return (
      <div className="w-80 border-l bg-card p-6 flex flex-col items-center justify-center text-center text-muted-foreground min-h-[600px] gap-6">
        <div>
          <Settings2 className="w-12 h-12 mb-4 mx-auto opacity-50" />
          <p>Select a node on the canvas to configure its properties.</p>
        </div>
        <Button onClick={handleAddNode} variant="outline" className="w-full gap-2">
          <Plus className="w-4 h-4" />
          Add New Node
        </Button>
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

      <div className="mt-auto pt-6 border-t space-y-4">
        <Button onClick={handleAddNode} variant="outline" className="w-full gap-2">
          <Plus className="w-4 h-4" />
          Add Node
        </Button>
        <Button onClick={handleDeleteNode} variant="destructive" className="w-full gap-2">
          <Trash2 className="w-4 h-4" />
          Delete Node
        </Button>
      </div>
    </div>
  );
}
