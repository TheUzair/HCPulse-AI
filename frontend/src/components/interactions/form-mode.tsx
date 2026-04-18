"use client";

import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/store/store";
import { updateDraft, setSubmitting } from "@/store/slices/interactionSlice";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { hcpApi, interactionApi } from "@/lib/api";
import { HCP } from "@/types";

export function FormMode() {
  const dispatch = useDispatch();
  const draft = useSelector((state: RootState) => state.interaction.draft);
  const isSubmitting = useSelector((state: RootState) => state.interaction.isSubmitting);
  const user = useSelector((state: RootState) => state.auth.user);
  const [hcps, setHcps] = useState<HCP[]>([]);
  const [productInput, setProductInput] = useState("");
  const [followUpInput, setFollowUpInput] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState(false);

  useEffect(() => {
    async function loadHCPs() {
      try {
        const res = await hcpApi.list({ limit: 100 });
        setHcps(res.data || []);
      } catch (err) {
        console.error("Failed to load HCPs:", err);
      }
    }
    loadHCPs();
  }, []);

  const addProduct = () => {
    if (productInput.trim()) {
      dispatch(
        updateDraft({
          products_discussed: [...draft.products_discussed, productInput.trim()],
        })
      );
      setProductInput("");
    }
  };

  const removeProduct = (index: number) => {
    dispatch(
      updateDraft({
        products_discussed: draft.products_discussed.filter((_, i) => i !== index),
      })
    );
  };

  const addFollowUp = () => {
    if (followUpInput.trim()) {
      dispatch(
        updateDraft({
          follow_up_actions: [...draft.follow_up_actions, followUpInput.trim()],
        })
      );
      setFollowUpInput("");
    }
  };

  const removeFollowUp = (index: number) => {
    dispatch(
      updateDraft({
        follow_up_actions: draft.follow_up_actions.filter((_, i) => i !== index),
      })
    );
  };

  const handleSubmit = async () => {
    if (!draft.hcp_id || !user?.id) return;

    dispatch(setSubmitting(true));
    try {
      await interactionApi.create(user.id, {
        hcp_id: draft.hcp_id,
        interaction_type: draft.interaction_type,
        date: draft.date,
        notes: draft.notes,
        products_discussed: draft.products_discussed,
        follow_up_actions: draft.follow_up_actions,
        follow_up_date: draft.follow_up_date || null,
      });
      setSubmitSuccess(true);
      setTimeout(() => setSubmitSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to create interaction:", err);
    } finally {
      dispatch(setSubmitting(false));
    }
  };

  return (
    <div className="space-y-6">
      {submitSuccess && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
          Interaction logged successfully!
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        {/* HCP Selection */}
        <div className="space-y-2">
          <Label htmlFor="hcp">Healthcare Professional *</Label>
          <Select
            value={draft.hcp_id}
            onValueChange={(value) => dispatch(updateDraft({ hcp_id: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select an HCP" />
            </SelectTrigger>
            <SelectContent>
              {hcps.map((hcp) => (
                <SelectItem key={hcp.id} value={hcp.id}>
                  Dr. {hcp.first_name} {hcp.last_name} — {hcp.specialty}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Interaction Type */}
        <div className="space-y-2">
          <Label htmlFor="type">Interaction Type *</Label>
          <Select
            value={draft.interaction_type}
            onValueChange={(value) => dispatch(updateDraft({ interaction_type: value }))}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="in_person">In Person</SelectItem>
              <SelectItem value="phone">Phone Call</SelectItem>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="video">Video Call</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Date */}
        <div className="space-y-2">
          <Label htmlFor="date">Date *</Label>
          <Input
            id="date"
            type="date"
            value={draft.date}
            onChange={(e) => dispatch(updateDraft({ date: e.target.value }))}
          />
        </div>

        {/* Follow-up Date */}
        <div className="space-y-2">
          <Label htmlFor="follow_up_date">Follow-up Date</Label>
          <Input
            id="follow_up_date"
            type="date"
            value={draft.follow_up_date || ""}
            onChange={(e) =>
              dispatch(updateDraft({ follow_up_date: e.target.value || undefined }))
            }
          />
        </div>
      </div>

      {/* Notes */}
      <div className="space-y-2">
        <Label htmlFor="notes">Interaction Notes</Label>
        <Textarea
          id="notes"
          placeholder="Describe the interaction details, key discussion points, and outcomes..."
          className="min-h-[120px]"
          value={draft.notes}
          onChange={(e) => dispatch(updateDraft({ notes: e.target.value }))}
        />
      </div>

      {/* Products Discussed */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Products Discussed</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Add a product..."
              value={productInput}
              onChange={(e) => setProductInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addProduct())}
            />
            <Button type="button" variant="outline" onClick={addProduct}>
              Add
            </Button>
          </div>
          {draft.products_discussed.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {draft.products_discussed.map((product, i) => (
                <Badge key={i} variant="secondary" className="gap-1">
                  {product}
                  <button
                    onClick={() => removeProduct(i)}
                    className="ml-1 rounded-full hover:bg-muted-foreground/20"
                  >
                    <svg className="h-3 w-3" viewBox="0 0 12 12" fill="currentColor">
                      <path d="M3.05 3.05a.75.75 0 011.06 0L6 4.94l1.89-1.89a.75.75 0 111.06 1.06L7.06 6l1.89 1.89a.75.75 0 11-1.06 1.06L6 7.06 4.11 8.95a.75.75 0 01-1.06-1.06L4.94 6 3.05 4.11a.75.75 0 010-1.06z" />
                    </svg>
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Follow-up Actions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">Follow-up Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input
              placeholder="Add a follow-up action..."
              value={followUpInput}
              onChange={(e) => setFollowUpInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addFollowUp())}
            />
            <Button type="button" variant="outline" onClick={addFollowUp}>
              Add
            </Button>
          </div>
          {draft.follow_up_actions.length > 0 && (
            <div className="space-y-2">
              {draft.follow_up_actions.map((action, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-md border p-2 text-sm"
                >
                  <span>{action}</span>
                  <button
                    onClick={() => removeFollowUp(i)}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Submit */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" type="button">
          Save Draft
        </Button>
        <Button onClick={handleSubmit} disabled={!draft.hcp_id || isSubmitting}>
          {isSubmitting ? (
            <>
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Logging...
            </>
          ) : (
            "Log Interaction"
          )}
        </Button>
      </div>
    </div>
  );
}
