import { useState } from "react";
import { Plus, Search, Edit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import useVendors from "@/hooks/useVendors";
import { apiRequest } from "@/lib/queryClient";
import { queryClient } from "@/lib/queryClient";

const vendorSchema = z.object({
  vendor_name: z.string().min(2, "Name must be at least 2 characters"),
  contact_info: z.string().optional(),
  fee_percentage: z.string().refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0,
    "Fee percentage must be a number greater than or equal to 0"
  ),
});

type VendorFormValues = z.infer<typeof vendorSchema>;

export default function Vendors() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [currentVendorId, setCurrentVendorId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  
  const { toast } = useToast();
  const { data: vendors, isLoading, isError } = useVendors();

  const filteredVendors = vendors?.filter(
    (vendor) => vendor.vendor_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const form = useForm<VendorFormValues>({
    resolver: zodResolver(vendorSchema),
    defaultValues: {
      vendor_name: "",
      contact_info: "",
      fee_percentage: "0.00",
    },
  });

  const handleAddVendor = async (data: VendorFormValues) => {
    try {
      await apiRequest("POST", "/api/vendors", data);
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      setIsAddDialogOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "Vendor added successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add vendor",
        variant: "destructive",
      });
    }
  };

  const handleEditVendor = async (data: VendorFormValues) => {
    if (!currentVendorId) return;
    
    try {
      await apiRequest("PATCH", `/api/vendors/${currentVendorId}`, data);
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      setIsEditDialogOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "Vendor updated successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update vendor",
        variant: "destructive",
      });
    }
  };

  const handleDeleteVendor = async () => {
    if (!currentVendorId) return;
    
    try {
      await apiRequest("DELETE", `/api/vendors/${currentVendorId}`, undefined);
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      setIsDeleteDialogOpen(false);
      toast({
        title: "Success",
        description: "Vendor deleted successfully",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete vendor. Vendor may have existing transactions.",
        variant: "destructive",
      });
    }
  };

  const openEditDialog = (vendor: typeof vendors[0]) => {
    setCurrentVendorId(vendor.vendor_id);
    form.reset({
      vendor_name: vendor.vendor_name,
      contact_info: vendor.contact_info || "",
      fee_percentage: vendor.fee_percentage.toString(),
    });
    setIsEditDialogOpen(true);
  };

  const openDeleteDialog = (vendorId: string) => {
    setCurrentVendorId(vendorId);
    setIsDeleteDialogOpen(true);
  };

  return (
    <div className="container mx-auto max-w-6xl p-4">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Vendors</h1>
        <Button onClick={() => {
          form.reset({
            vendor_name: "",
            contact_info: "",
            fee_percentage: "0.00",
          });
          setIsAddDialogOpen(true);
        }}>
          <Plus className="mr-2 h-4 w-4" />
          Add Vendor
        </Button>
      </div>

      <div className="mb-6">
        <Input
          type="text"
          placeholder="Search vendors..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
        />
      </div>

      {isLoading ? (
        <div className="flex h-40 w-full items-center justify-center">
          <div className="text-center">
            <div className="mb-2 h-6 w-6 animate-spin rounded-full border-b-2 border-primary"></div>
            <p className="text-sm text-gray-500">Loading vendors...</p>
          </div>
        </div>
      ) : isError ? (
        <div className="rounded-md bg-red-50 p-4 text-center text-red-500">
          <p>Error loading vendors</p>
        </div>
      ) : filteredVendors && filteredVendors.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredVendors.map((vendor) => (
            <Card key={vendor.vendor_id}>
              <CardContent className="p-4">
                <div className="flex justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">{vendor.vendor_name}</h3>
                    <p className="text-sm text-gray-500">{vendor.contact_info || "No contact info"}</p>
                    <p className="mt-2 text-sm">
                      <span className="font-medium">ID:</span> {vendor.vendor_id}
                    </p>
                    <p className="text-sm">
                      <span className="font-medium">Fee:</span> {vendor.fee_percentage}%
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="ghost" size="icon" onClick={() => openEditDialog(vendor)}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => openDeleteDialog(vendor.vendor_id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="rounded-md bg-gray-50 p-8 text-center">
          <p className="text-gray-500">No vendors found</p>
        </div>
      )}

      {/* Add Vendor Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Vendor</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleAddVendor)} className="space-y-4">
              <FormField
                control={form.control}
                name="vendor_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vendor Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contact_info"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Information</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="fee_percentage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fee Percentage</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" step="0.01" min="0" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Add Vendor</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Vendor Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Vendor</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleEditVendor)} className="space-y-4">
              <FormField
                control={form.control}
                name="vendor_name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vendor Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="contact_info"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Contact Information</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="fee_percentage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fee Percentage</FormLabel>
                    <FormControl>
                      <Input {...field} type="number" step="0.01" min="0" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">Update Vendor</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
          </DialogHeader>
          <p>Are you sure you want to delete this vendor? This action cannot be undone.</p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={handleDeleteVendor}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
