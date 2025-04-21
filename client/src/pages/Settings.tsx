import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

export default function Settings() {
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState("account");
  
  // Sample form state
  const [formData, setFormData] = useState({
    companyName: "Cheque Ledger Pro",
    email: "admin@chequeledger.com",
    notificationsEnabled: true,
    darkModeEnabled: false,
    telegramEnabled: true,
    telegramChatId: "123456789",
    dateFormat: "MM/DD/YYYY",
    currencySymbol: "$"
  });
  
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
  };
  
  const handleSwitchChange = (name: string, checked: boolean) => {
    setFormData({ ...formData, [name]: checked });
  };
  
  const handleSaveSettings = () => {
    // In a real app, this would save to the backend
    toast({
      title: "Settings Saved",
      description: "Your settings have been successfully updated."
    });
  };
  
  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500">Manage your application preferences</p>
      </div>
      
      <Tabs defaultValue="account" onValueChange={setSelectedTab}>
        <TabsList className="mb-6 grid w-full grid-cols-4 max-w-md">
          <TabsTrigger value="account">Account</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
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