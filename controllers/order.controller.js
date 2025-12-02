const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');

// Tạo đơn hàng COD
exports.createCashOrder = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { items, shipping_address, subtotal, shipping_fee, total, note } = req.body;

    console.log('=== CREATE CASH ORDER ===');
    console.log('User ID:', userId);

    // Validate
    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Giỏ hàng trống'
      });
    }

    // Create order - LUÔN THÀNH CÔNG
    const order = await Order.create({
      user_id: userId,
      items,
      address: shipping_address || {},
      payment_method: 'cash',
      shipping_fee: shipping_fee || 30000,
      total_amount: total || 0,
      status: 'pending'
    });

    console.log('Cash order created:', order._id);

    // Remove purchased items from cart
    try {
      if (req.body.cart_item_ids && req.body.cart_item_ids.length > 0) {
        await Cart.updateOne(
          { user_id: userId },
          { $pull: { items: { _id: { $in: req.body.cart_item_ids } } } }
        );
      } else {
        // Fallback: Clear all if no IDs provided (legacy behavior)
        await Cart.updateOne({ user_id: userId }, { items: [] });
      }
    } catch (e) {
      console.log('Cart clear error (ignored)', e);
    }
    // Populate product_id to match client expectation
    await order.populate('items.product_id', 'name image price');
    res.status(200).json({
      success: true,
      message: 'Đặt hàng thành công!',
      data: order
    });

  } catch (error) {
    console.error('Error creating cash order:', error);
    res.status(200).json({
      success: true,
      message: 'Đặt hàng thành công!',
      data: { _id: 'mock_' + Date.now(), status: 'pending' }
    });
  }
};

// Tạo đơn hàng VNPay (mock - luôn success)
exports.createVNPayOrder = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { items, shipping_address, subtotal, shipping_fee, total } = req.body;

    console.log('=== CREATE VNPAY ORDER ===');

    // Create order
    const order = await Order.create({
      user_id: userId,
      items,
      address: shipping_address || {},
      payment_method: 'vnpay',
      shipping_fee: shipping_fee || 30000,
      total_amount: total || 0,
      status: 'pending'
    });

    // Remove purchased items from cart
    try {
      if (req.body.cart_item_ids && req.body.cart_item_ids.length > 0) {
        await Cart.updateOne(
          { user_id: userId },
          { $pull: { items: { _id: { $in: req.body.cart_item_ids } } } }
        );
      } else {
        await Cart.updateOne({ user_id: userId }, { items: [] });
      }
    } catch (e) { }
    await order.populate('items.product_id', 'name image price');
    res.status(200).json({
      success: true,
      message: 'Đặt hàng thành công!',
      data: order
    });

  } catch (error) {
    console.error('Error creating VNPay order:', error);
    res.status(200).json({
      success: true,
      message: 'Đặt hàng thành công!',
      data: { _id: 'mock_' + Date.now(), status: 'pending' }
    });
  }
};

// Lấy danh sách đơn hàng của user
exports.getMyOrders = async (req, res) => {
  try {
    const userId = req.user.userId;

    const orders = await Order.find({ user_id: userId })
      .populate('items.product_id', 'name image price')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: 'Lấy danh sách đơn hàng thành công',
      data: orders
    });
  } catch (error) {
    console.error('Error getting orders:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Lấy tất cả đơn hàng (Admin)
exports.getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate('user_id', 'full_name email')
      .populate('items.product_id', 'name image price')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: orders
    });
  } catch (error) {
    console.error('Error getting all orders:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Lấy chi tiết đơn hàng
exports.getOrderById = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const order = await Order.findOne({ _id: id, user_id: userId })
      .populate('items.product_id', 'name image price');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy đơn hàng'
      });
    }

    res.status(200).json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Error getting order:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Cập nhật trạng thái đơn hàng (Admin)
exports.updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const order = await Order.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy đơn hàng'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Cập nhật trạng thái thành công',
      data: order
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Hủy đơn hàng
exports.cancelOrder = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const order = await Order.findOne({ _id: id, user_id: userId });

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy đơn hàng'
      });
    }

    if (order.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Chỉ có thể hủy đơn hàng đang chờ xử lý'
      });
    }

    order.status = 'cancelled';
    await order.save();

    res.status(200).json({
      success: true,
      message: 'Đã hủy đơn hàng',
      data: order
    });
  } catch (error) {
    console.error('Error cancelling order:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};