import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger 
} from "@/components/ui/dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Loader2, Plus, Pencil, Trash2, Shield } from "lucide-react";
import { InsertUser } from "@shared/schema";

// Create our own User interface to match backend structure
interface AppUser {
  user_id: number;
  username: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: "user" | "admin" | "superuser";
  is_active: boolean;
  last_login: string | null;
  created_at: string | null;
  updated_at: string | null;
}

type UserFormData = {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
  first_name: string;
  last_name: string;
  role: "user" | "admin" | "superuser";
  is_active?: boolean;
};

export default function Settings() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedTab, setSelectedTab] = useState("account");
  const [isAddUserDialogOpen, setIsAddUserDialogOpen] = useState(false);
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  
  // Define a user type for easier handling
  type UserWithoutPassword = Omit<Express.User, 'password'> & {
    password?: undefined;
  };
  
  // Fetch users from the API
  const [users, setUsers] = useState<UserWithoutPassword[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithoutPassword | null>(null);
  
  // Fetch users when the tab changes to "users"
  useEffect(() => {
    if (selectedTab === "users" && isAdminOrSuperuser) {
      fetchUsers();
    }
  }, [selectedTab]);
  
  const fetchUsers = async () => {
    setIsLoadingUsers(true);
    try {
      const response = await fetch('/api/users');
      if (!response.ok) {
        throw new Error('Failed to fetch users');
      }
      const data = await response.json();
      setUsers(data);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: "Error",
        description: "Failed to load users. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoadingUsers(false);
    }
  };
  
  // New user form state
  const [newUserForm, setNewUserForm] = useState<UserFormData>({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    first_name: "",
    last_name: "",
    role: "user"
  });
  
  // Edit user form state
  const [editUserForm, setEditUserForm] = useState<Partial<UserFormData>>({
    email: "",
    first_name: "",
    last_name: "",
    role: "user",
    is_active: true
  });
  
  // Sample form state for general settings
  const [formData, setFormData] = useState({
    companyName: "Cheque Ledger Pro",
    email: user?.email || "admin@chequeledger.com",
    notificationsEnabled: true,
    darkModeEnabled: false,
    telegramEnabled: true,
    telegramChatId: "123456789",
    dateFormat: "MM/DD/YYYY",
    currencySymbol: "$"
  });
  
  // Handle changes in the general settings form
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };
  
  const handleSwitchChange = (name: string, checked: boolean) => {
    setFormData({ ...formData, [name]: checked });
  };
  
  // Handle changes in the new user form
  const handleNewUserInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setNewUserForm({ ...newUserForm, [name]: value });
  };
  
  // Handle changes in the edit user form
  const handleEditUserInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditUserForm({ ...editUserForm, [name]: value });
  };
  
  const handleNewUserRoleChange = (value: "user" | "admin" | "superuser") => {
    setNewUserForm({ ...newUserForm, role: value });
  };
  
  const handleEditUserRoleChange = (value: "user" | "admin" | "superuser") => {
    setEditUserForm({ ...editUserForm, role: value });
  };
  
  const handleEditUserStatusChange = (checked: boolean) => {
    setEditUserForm({ ...editUserForm, is_active: checked });
  };
  
  const handleSaveSettings = () => {
    // In a real app, this would save to the backend
    toast({
      title: "Settings Saved",
      description: "Your settings have been successfully updated."
    });
  };
  
  const handleAddUser = async () => {
    // Validation
    if (newUserForm.password !== newUserForm.confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive"
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Use the user registration API endpoint
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: newUserForm.username,
          email: newUserForm.email,
          password: newUserForm.password,
          confirmPassword: newUserForm.confirmPassword,
          first_name: newUserForm.first_name,
          last_name: newUserForm.last_name,
          role: newUserForm.role
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create user');
      }
      
      const newUser = await response.json();
      
      // Refresh the list of users
      fetchUsers();
      
      // Reset form
      setNewUserForm({
        username: "",
        email: "",
        password: "",
        confirmPassword: "",
        first_name: "",
        last_name: "",
        role: "user"
      });
      
      setIsAddUserDialogOpen(false);
      
      toast({
        title: "User Added",
        description: `New ${newUserForm.role} has been added successfully.`
      });
    } catch (error) {
      console.error('Error creating user:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to create user',
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleEditUser = async () => {
    // Don't allow regular users to modify admin/superuser
    if (!isSuperuser && selectedUser.role !== "user") {
      toast({
        title: "Permission Denied",
        description: "Only superusers can modify admin accounts",
        variant: "destructive"
      });
      return;
    }
    
    setIsLoading(true);
    
    try {
      // Call the API to update the user
      const response = await fetch(`/api/users/${selectedUser.user_id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: editUserForm.email,
          first_name: editUserForm.first_name,
          last_name: editUserForm.last_name,
          role: editUserForm.role,
          is_active: editUserForm.is_active
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to update user');
      }
      
      // Refresh the list of users
      fetchUsers();
      
      setIsEditUserDialogOpen(false);
      
      toast({
        title: "User Updated",
        description: "User has been updated successfully."
      });
    } catch (error) {
      console.error('Error updating user:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to update user',
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  const handleStartEditUser = (userToEdit: any) => {
    setSelectedUser(userToEdit);
    
    // Pre-fill the edit form with the user's current data
    setEditUserForm({
      email: userToEdit.email,
      first_name: userToEdit.first_name || '',
      last_name: userToEdit.last_name || '',
      role: userToEdit.role,
      is_active: userToEdit.is_active
    });
    
    setIsEditUserDialogOpen(true);
  };
  
  const handleDeleteUser = async (userId: number) => {
    // Don't allow deleting your own account
    if (userId === user?.user_id) {
      toast({
        title: "Cannot Delete",
        description: "You cannot delete your own account",
        variant: "destructive"
      });
      return;
    }
    
    try {
      // Call the API to delete the user
      const response = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete user');
      }
      
      // Update UI after successful deletion
      setUsers(users.filter(u => u.user_id !== userId));
      
      toast({
        title: "User Deleted",
        description: "User has been deleted successfully."
      });
    } catch (error) {
      console.error('Error deleting user:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to delete user',
        variant: "destructive"
      });
    }
  };
  
  // Determine if the current user is admin or superuser
  const isAdminOrSuperuser = user?.role === "admin" || user?.role === "superuser";
  const isSuperuser = user?.role === "superuser";
  
  // Convert tabs list to array for dynamic rendering
  const tabs = [
    { value: "account", label: "Account" },
    { value: "appearance", label: "Appearance" },
    { value: "notifications", label: "Notifications" },
    ...(isAdminOrSuperuser ? [{ value: "users", label: "User Management" }] : []),
    { value: "advanced", label: "Advanced" }
  ];
  
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500">Manage your application preferences</p>
      </div>
      
      <Tabs defaultValue="account" onValueChange={setSelectedTab}>
        <TabsList className="mb-6 grid w-full max-w-2xl" style={{ gridTemplateColumns: `repeat(${tabs.length}, 1fr)` }}>
          {tabs.map(tab => (
            <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>
          ))}
        </TabsList>
        
        <TabsContent value="account">
          <Card>
            <CardHeader>
              <CardTitle>Account Settings</CardTitle>
              <CardDescription>
                Manage your account information and preferences
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="companyName">Company Name</Label>
                <Input 
                  id="companyName" 
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleInputChange}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <Input 
                  id="email" 
                  name="email" 
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                />
              </div>
              
              <Button onClick={handleSaveSettings}>Save Changes</Button>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>Appearance Settings</CardTitle>
              <CardDescription>
                Customize how the application looks
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="darkMode">Dark Mode</Label>
                <Switch 
                  id="darkMode" 
                  checked={formData.darkModeEnabled}
                  onCheckedChange={(checked) => handleSwitchChange("darkModeEnabled", checked)}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="dateFormat">Date Format</Label>
                <Input 
                  id="dateFormat" 
                  name="dateFormat"
                  value={formData.dateFormat}
                  onChange={handleInputChange}
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="currencySymbol">Currency Symbol</Label>
                <Input 
                  id="currencySymbol" 
                  name="currencySymbol"
                  value={formData.currencySymbol}
                  onChange={handleInputChange}
                />
              </div>
              
              <Button onClick={handleSaveSettings}>Save Changes</Button>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notification Settings</CardTitle>
              <CardDescription>
                Manage how and when you receive notifications
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="notifications">Email Notifications</Label>
                <Switch 
                  id="notifications" 
                  checked={formData.notificationsEnabled}
                  onCheckedChange={(checked) => handleSwitchChange("notificationsEnabled", checked)}
                />
              </div>
              
              <div className="flex items-center justify-between">
                <Label htmlFor="telegram">Telegram Notifications</Label>
                <Switch 
                  id="telegram" 
                  checked={formData.telegramEnabled}
                  onCheckedChange={(checked) => handleSwitchChange("telegramEnabled", checked)}
                />
              </div>
              
              {formData.telegramEnabled && (
                <div className="space-y-2">
                  <Label htmlFor="telegramChatId">Telegram Chat ID</Label>
                  <Input 
                    id="telegramChatId" 
                    name="telegramChatId"
                    value={formData.telegramChatId}
                    onChange={handleInputChange}
                  />
                </div>
              )}
              
              <Button onClick={handleSaveSettings}>Save Changes</Button>
            </CardContent>
          </Card>
        </TabsContent>
        
        {isAdminOrSuperuser && (
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>User Management</CardTitle>
                    <CardDescription>
                      {isSuperuser 
                        ? "As a Superuser, you can manage all users and admins" 
                        : "As an Admin, you can manage regular users"}
                    </CardDescription>
                  </div>
                  <Dialog open={isAddUserDialogOpen} onOpenChange={setIsAddUserDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="mr-2 h-4 w-4" />
                        Add User
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle>Add New User</DialogTitle>
                        <DialogDescription>
                          Create a new user account. {!isSuperuser && "As an Admin, you can only create regular user accounts."}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="first_name">First Name</Label>
                            <Input
                              id="first_name"
                              name="first_name"
                              value={newUserForm.first_name}
                              onChange={handleNewUserInputChange}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="last_name">Last Name</Label>
                            <Input
                              id="last_name"
                              name="last_name"
                              value={newUserForm.last_name}
                              onChange={handleNewUserInputChange}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="username">Username</Label>
                          <Input
                            id="username"
                            name="username"
                            value={newUserForm.username}
                            onChange={handleNewUserInputChange}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            name="email"
                            type="email"
                            value={newUserForm.email}
                            onChange={handleNewUserInputChange}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="password">Password</Label>
                          <Input
                            id="password"
                            name="password"
                            type="password"
                            value={newUserForm.password}
                            onChange={handleNewUserInputChange}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="confirmPassword">Confirm Password</Label>
                          <Input
                            id="confirmPassword"
                            name="confirmPassword"
                            type="password"
                            value={newUserForm.confirmPassword}
                            onChange={handleNewUserInputChange}
                          />
                        </div>
                        {isSuperuser && (
                          <div className="space-y-2">
                            <Label htmlFor="role">Role</Label>
                            <Select
                              value={newUserForm.role}
                              onValueChange={(value: any) => handleNewUserRoleChange(value)}
                            >
                              <SelectTrigger id="role">
                                <SelectValue placeholder="Select a role" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="user">User</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="superuser">Superuser</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                      </div>
                      <DialogFooter>
                        <Button 
                          variant="outline" 
                          onClick={() => setIsAddUserDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button 
                          type="submit" 
                          onClick={handleAddUser}
                          disabled={isLoading}
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Creating...
                            </>
                          ) : (
                            "Create User"
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  
                  {/* Edit User Dialog */}
                  <Dialog open={isEditUserDialogOpen} onOpenChange={setIsEditUserDialogOpen}>
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle>Edit User</DialogTitle>
                        <DialogDescription>
                          Update user information for {selectedUser?.username}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="edit_first_name">First Name</Label>
                            <Input
                              id="edit_first_name"
                              name="first_name"
                              value={editUserForm.first_name}
                              onChange={handleEditUserInputChange}
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="edit_last_name">Last Name</Label>
                            <Input
                              id="edit_last_name"
                              name="last_name"
                              value={editUserForm.last_name}
                              onChange={handleEditUserInputChange}
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="edit_email">Email</Label>
                          <Input
                            id="edit_email"
                            name="email"
                            type="email"
                            value={editUserForm.email}
                            onChange={handleEditUserInputChange}
                          />
                        </div>
                        
                        {/* Role selection (only for superusers) */}
                        {isSuperuser && (
                          <div className="space-y-2">
                            <Label htmlFor="edit_role">Role</Label>
                            <Select 
                              value={editUserForm.role} 
                              onValueChange={(value: any) => handleEditUserRoleChange(value)}>
                              <SelectTrigger id="edit_role">
                                <SelectValue placeholder="Select a role" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="user">User</SelectItem>
                                <SelectItem value="admin">Admin</SelectItem>
                                <SelectItem value="superuser">Superuser</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        )}
                        
                        {/* Active status toggle */}
                        <div className="flex items-center justify-between">
                          <Label htmlFor="edit_is_active">Active Account</Label>
                          <Switch 
                            id="edit_is_active" 
                            checked={editUserForm.is_active} 
                            onCheckedChange={handleEditUserStatusChange}
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button 
                          variant="outline" 
                          onClick={() => setIsEditUserDialogOpen(false)}
                        >
                          Cancel
                        </Button>
                        <Button 
                          type="submit" 
                          onClick={handleEditUser}
                          disabled={isLoading}
                        >
                          {isLoading ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Updating...
                            </>
                          ) : (
                            "Update User"
                          )}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {isLoadingUsers ? (
                  <div className="flex justify-center items-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <span className="ml-2 text-gray-500">Loading users...</span>
                  </div>
                ) : users.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>No users found. Add a new user to get started.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Username</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users
                        // If admin, filter out superusers and other admins
                        .filter(userItem => {
                          if (isSuperuser) return true;
                          return userItem.role === "user";
                        })
                        .map(userItem => (
                          <TableRow key={userItem.user_id}>
                            <TableCell className="font-medium">{userItem.username}</TableCell>
                            <TableCell>{`${userItem.first_name || ''} ${userItem.last_name || ''}`}</TableCell>
                            <TableCell>{userItem.email}</TableCell>
                            <TableCell>
                              <div className="flex items-center">
                                {userItem.role === "superuser" && <Shield className="mr-1 h-4 w-4 text-red-600" />}
                                <span className={`capitalize ${
                                  userItem.role === "superuser" 
                                    ? "text-red-600 font-semibold" 
                                    : userItem.role === "admin" 
                                      ? "text-blue-600 font-semibold" 
                                      : ""
                                }`}>
                                  {userItem.role}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell>
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                userItem.is_active 
                                  ? "bg-green-100 text-green-800" 
                                  : "bg-red-100 text-red-800"
                              }`}>
                                {userItem.is_active ? "Active" : "Inactive"}
                              </span>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end space-x-2">
                                <Button 
                                  variant="outline" 
                                  size="icon"
                                  onClick={() => handleStartEditUser(userItem)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="icon" 
                                  className="text-red-600 hover:text-red-700"
                                  onClick={() => handleDeleteUser(userItem.user_id)}
                                  disabled={userItem.user_id === user?.user_id}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
        
        <TabsContent value="advanced">
          <Card>
            <CardHeader>
              <CardTitle>Advanced Settings</CardTitle>
              <CardDescription>
                Configure advanced system settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 border border-red-200 rounded-md bg-red-50">
                <p className="text-sm text-red-600">
                  Advanced settings are for experienced users. Changes here may affect system functionality.
                </p>
              </div>
              
              <Button variant="destructive">Reset All Settings</Button>
              <Button className="ml-2" onClick={handleSaveSettings}>Save Changes</Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}